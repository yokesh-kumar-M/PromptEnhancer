import json
import secrets
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from decouple import config
from rest_framework import viewsets

from .models import AccessRequest, EnhancementLog, InviteCode, PromptTemplate, UserProfile
from .serializers import PromptTemplateSerializer

# ======================== SYSTEM PROMPTS ========================

SYSTEM_PROMPTS = {
    'Enhance': (
        "You are a world-class prompt engineer. Transform the user's vague request into a highly structured, "
        "context-rich prompt optimized for AI models.\n\n"
        "Rules:\n"
        "- Add clear context, constraints, and desired output format\n"
        "- Include role definition, task description, and success criteria\n"
        "- Use markdown formatting where appropriate\n"
        "- Return ONLY the enhanced prompt, no explanations or preambles\n"
        "- Make it 3-5x more detailed than the original"
    ),
    'Professional': (
        "You are an expert business communications specialist. Rewrite the user's text to be highly professional, "
        "articulate, and suitable for corporate environments.\n\n"
        "Rules:\n"
        "- Use formal but natural language\n"
        "- Maintain the original meaning\n"
        "- Fix grammar, tone, and structure\n"
        "- Return ONLY the rewritten text\n"
        "- Keep it concise yet impactful"
    ),
    'Shorten': (
        "You are a concise writing expert. Shorten the user's text while preserving ALL key information.\n\n"
        "Rules:\n"
        "- Cut unnecessary words and redundancies\n"
        "- Use active voice\n"
        "- Maintain the core message\n"
        "- Return ONLY the shortened text\n"
        "- Aim for 40-60% of original length"
    ),
    'Code': (
        "You are a senior software architect. Transform the user's request into a precise, technical prompt "
        "optimized for code generation.\n\n"
        "Rules:\n"
        "- Specify programming language, framework, and version if known\n"
        "- Include input/output specifications\n"
        "- Add error handling and edge case requirements\n"
        "- Request code documentation and type annotations\n"
        "- Return ONLY the enhanced technical prompt"
    ),
    'Creative': (
        "You are a creative writing virtuoso. Transform the user's text into something vivid, imaginative, "
        "and emotionally engaging.\n\n"
        "Rules:\n"
        "- Use sensory language and powerful metaphors\n"
        "- Add emotional depth and narrative flair\n"
        "- Maintain the original intent\n"
        "- Return ONLY the enhanced text\n"
        "- Make it memorable and share-worthy"
    ),
}

# ======================== DECORATORS ========================


def admin_required(view_func):
    """Restricts view to staff/superusers only."""
    decorated = user_passes_test(
        lambda u: u.is_active and u.is_staff,
        login_url='/login/'
    )(view_func)
    return login_required(decorated)


# ======================== API HELPERS ========================


class PromptTemplateViewSet(viewsets.ModelViewSet):
    queryset = PromptTemplate.objects.all()
    serializer_class = PromptTemplateSerializer


def _resolve_invite(code: str):
    """Returns InviteCode if valid and active, respects max_uses gate."""
    if not code:
        return None
    try:
        invite = InviteCode.objects.get(code=code, is_active=True)
        if invite.max_uses > 0 and invite.total_uses >= invite.max_uses:
            return None
        return invite
    except InviteCode.DoesNotExist:
        return None


def _find_invite(code: str):
    """Returns InviteCode if active, without max_uses check (for logging)."""
    if not code:
        return None
    try:
        return InviteCode.objects.get(code=code, is_active=True)
    except InviteCode.DoesNotExist:
        return None


def _call_gemini(text: str, action: str, api_key: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    system = SYSTEM_PROMPTS.get(action, SYSTEM_PROMPTS['Enhance'])
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=system,
    )
    response = model.generate_content(
        text,
        generation_config=genai.types.GenerationConfig(
            temperature=0.9 if action == 'Creative' else 0.7,
            max_output_tokens=4096,
        ),
    )
    return response.text.strip()


# ======================== PUBLIC API VIEWS ========================


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def validate_invite(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    try:
        data = json.loads(request.body)
        code = data.get('code', '').strip()
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'valid': False, 'message': 'Invalid request body'}, status=400)

    invite = _resolve_invite(code)
    if invite:
        return JsonResponse({
            'valid': True,
            'message': 'Access granted',
            'label': invite.label or invite.email or '',
        })
    return JsonResponse({'valid': False, 'message': 'Invalid or expired invite code'})


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def enhance_prompt(request):
    """Server-side enhancement endpoint — used by VS Code extension and CLI."""
    if request.method == 'OPTIONS':
        return JsonResponse({})

    invite_code = request.headers.get('X-Invite-Code', '').strip()
    invite = _resolve_invite(invite_code)
    if not invite:
        return JsonResponse({'error': 'Invalid or missing invite code'}, status=401)

    try:
        data = json.loads(request.body)
        text = data.get('text', '').strip()
        action = data.get('action', 'Enhance')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request body'}, status=400)

    if not text:
        return JsonResponse({'error': 'No text provided'}, status=400)
    if len(text) > 10000:
        return JsonResponse({'error': 'Text too long (max 10 000 chars)'}, status=400)

    api_key = config('GEMINI_API_KEY', default='')
    if not api_key or api_key == 'your-gemini-api-key-here':
        return JsonResponse({'error': 'Enhancement service not configured on server'}, status=503)

    try:
        result = _call_gemini(text, action, api_key)

        invite.total_uses += 1
        invite.last_used_at = timezone.now()
        invite.save(update_fields=['total_uses', 'last_used_at'])

        EnhancementLog.objects.create(
            invite_code=invite,
            action=action,
            provider='gemini',
            model_used='gemini-2.5-flash',
            original_char_count=len(text),
            enhanced_char_count=len(result),
        )

        return JsonResponse({'enhanced': result})

    except Exception as exc:
        return JsonResponse({'error': f'Enhancement failed: {exc}'}, status=500)


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def log_usage(request):
    """Called by the Chrome extension after a successful client-side BYOK enhancement."""
    if request.method == 'OPTIONS':
        return JsonResponse({})

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'logged': False, 'error': 'Invalid JSON'}, status=400)

    invite_code_str = data.get('invite_code', '').strip()
    invite = _find_invite(invite_code_str)

    user = None
    if invite:
        try:
            user = UserProfile.objects.get(invite_code=invite).user
        except UserProfile.DoesNotExist:
            pass
        invite.last_used_at = timezone.now()
        invite.save(update_fields=['last_used_at'])

    EnhancementLog.objects.create(
        user=user,
        invite_code=invite,
        action=data.get('action', 'Enhance')[:50],
        provider=data.get('provider', 'gemini')[:20],
        model_used=data.get('model', '')[:100],
        original_char_count=int(data.get('original_len', 0)),
        enhanced_char_count=int(data.get('enhanced_len', 0)),
        domain=data.get('domain', '')[:255],
    )

    if user:
        try:
            profile = user.profile
            profile.total_enhancements += 1
            profile.save(update_fields=['total_enhancements'])
        except UserProfile.DoesNotExist:
            pass

    return JsonResponse({'logged': True})


# ======================== ADMIN API VIEWS ========================


@csrf_exempt
@login_required
def admin_enhance_api(request):
    """Quick enhancement endpoint for admin dashboard. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        text = data.get('text', '').strip()
        action = data.get('action', 'Enhance')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request body'}, status=400)

    if not text:
        return JsonResponse({'error': 'No text provided'}, status=400)

    api_key = config('GEMINI_API_KEY', default='')
    if not api_key or api_key == 'your-gemini-api-key-here':
        return JsonResponse({'error': 'GEMINI_API_KEY not configured on server'}, status=503)

    try:
        result = _call_gemini(text, action, api_key)

        EnhancementLog.objects.create(
            user=request.user,
            action=action,
            provider='gemini',
            model_used='gemini-2.5-flash',
            original_char_count=len(text),
            enhanced_char_count=len(result),
            domain='admin-dashboard',
        )

        return JsonResponse({'enhanced': result, 'chars_in': len(text), 'chars_out': len(result)})

    except Exception as exc:
        return JsonResponse({'error': f'Enhancement failed: {exc}'}, status=500)


@csrf_exempt
@login_required
def admin_generate_invite(request):
    """Generate a new invite code. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        data = {}

    invite = InviteCode.objects.create(
        code=secrets.token_urlsafe(16),
        label=data.get('label', '').strip()[:100],
        email=data.get('email', '').strip()[:254],
        max_uses=int(data.get('max_uses', 0)),
    )

    return JsonResponse({
        'code': invite.code,
        'id': invite.id,
        'label': invite.label,
        'email': invite.email,
        'max_uses': invite.max_uses,
        'created_at': invite.created_at.isoformat(),
    })


@login_required
def admin_invites_data(request):
    """Return invite codes as JSON for admin dashboard. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    invites = InviteCode.objects.order_by('-created_at')[:50].values(
        'id', 'code', 'label', 'email', 'is_active', 'total_uses',
        'max_uses', 'created_at', 'last_used_at'
    )
    return JsonResponse({'invites': list(invites)}, json_dumps_params={'default': str})


# ======================== WEB VIEWS ========================


def landing_view(request):
    if request.user.is_authenticated and request.user.is_staff:
        return redirect('dashboard')
    return render(request, 'landing.html')


def request_access_view(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        name = request.POST.get('name', '').strip()
        reason = request.POST.get('reason', '').strip()

        if not email:
            return render(request, 'request_access.html', {'error': 'Email address is required.'})

        if AccessRequest.objects.filter(email=email).exists():
            return render(request, 'request_access.html', {
                'submitted': True,
                'message': "We already have your request! We'll email you an invite code once approved.",
            })

        AccessRequest.objects.create(email=email, name=name, reason=reason)

        admin_email = getattr(settings, 'ADMIN_EMAIL', 'dezprox25@gmail.com')
        try:
            send_mail(
                subject=f'[PromptEnhancer] New access request from {name or email}',
                message=(
                    f'Name: {name or "(not provided)"}\n'
                    f'Email: {email}\n'
                    f'Reason: {reason or "(not provided)"}\n\n'
                    f'Approve in admin panel:\n'
                    f'{getattr(settings, "BACKEND_URL", "")}/admin/prompt_engine/accessrequest/'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin_email],
                fail_silently=True,
            )
        except Exception:
            pass

        return render(request, 'request_access.html', {
            'submitted': True,
            'message': f"Request submitted! We'll send your invite code to {email} once approved.",
        })

    return render(request, 'request_access.html')


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    error = None
    next_url = request.GET.get('next', '/dashboard/')

    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        password = request.POST.get('password', '')
        next_url = request.POST.get('next', '/dashboard/')

        user_obj = User.objects.filter(email=email).first()
        user = authenticate(request, username=user_obj.username, password=password) if user_obj else None

        if user:
            login(request, user)
            return redirect(next_url if next_url.startswith('/') else '/dashboard/')

        error = 'Invalid email or password.'

    return render(request, 'login.html', {'error': error, 'next': next_url})


def logout_view(request):
    logout(request)
    return redirect('landing')


def register_view(request):
    code = request.GET.get('code', '').strip()
    prefill_invite = _resolve_invite(code)
    error = None

    if request.method == 'POST':
        invite_code_str = request.POST.get('invite_code', '').strip()
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip().lower()
        password = request.POST.get('password', '')

        invite = _resolve_invite(invite_code_str)
        if not invite:
            error = 'Invalid or expired invite code. Check the link in your email.'
        elif not all([name, email, password]):
            error = 'All fields are required.'
        elif len(password) < 8:
            error = 'Password must be at least 8 characters long.'
        elif User.objects.filter(email=email).exists():
            error = 'An account with this email already exists. Try signing in.'
        else:
            username = f"{email.split('@')[0]}_{secrets.token_hex(3)}"
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=name,
            )
            UserProfile.objects.create(user=user, invite_code=invite)
            login(request, user)
            return redirect('dashboard')

        return render(request, 'register.html', {
            'error': error,
            'invite_code': invite_code_str,
            'name': name,
            'email': email,
        })

    return render(request, 'register.html', {
        'invite_code': code,
        'invite_valid': prefill_invite is not None,
    })


@admin_required
def dashboard_view(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    logs = EnhancementLog.objects.all()

    now = timezone.now()
    today = now.date()
    week_ago = today - timezone.timedelta(days=7)
    month_ago = today - timezone.timedelta(days=30)

    total = logs.count()
    today_count = logs.filter(created_at__date=today).count()
    week_count = logs.filter(created_at__date__gte=week_ago).count()
    month_count = logs.filter(created_at__date__gte=month_ago).count()

    avg_per_day = round(month_count / 30, 1) if month_count else 0

    by_action: dict[str, int] = {}
    by_provider: dict[str, int] = {}
    by_domain: dict[str, int] = {}
    for log in logs.values('action', 'provider', 'domain'):
        by_action[log['action']] = by_action.get(log['action'], 0) + 1
        by_provider[log['provider']] = by_provider.get(log['provider'], 0) + 1
        if log['domain']:
            by_domain[log['domain']] = by_domain.get(log['domain'], 0) + 1

    by_action_data = sorted(
        [{'name': k, 'count': v, 'pct': round(v / total * 100) if total else 0}
         for k, v in by_action.items()],
        key=lambda x: -x['count'],
    )

    top_domains = sorted(
        [{'domain': k, 'count': v} for k, v in by_domain.items()],
        key=lambda x: -x['count'],
    )[:8]

    recent = logs.select_related('invite_code', 'user')[:20]

    invite_count = InviteCode.objects.filter(is_active=True).count()
    invite_total = InviteCode.objects.count()

    api_key_configured = bool(config('GEMINI_API_KEY', default='')) and \
        config('GEMINI_API_KEY', default='') != 'your-gemini-api-key-here'

    return render(request, 'dashboard.html', {
        'profile': profile,
        'stats': {
            'total': total,
            'today': today_count,
            'week': week_count,
            'month': month_count,
            'avg_per_day': avg_per_day,
        },
        'by_action': by_action_data,
        'by_provider': by_provider,
        'top_domains': top_domains,
        'recent': recent,
        'invite_count': invite_count,
        'invite_total': invite_total,
        'api_key_configured': api_key_configured,
        'backend_url': getattr(settings, 'BACKEND_URL', 'http://localhost:8000'),
    })
