import json
import secrets
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import connection
from django.db.models import Count, Q
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

# ======================== TOKEN AUTH HELPER ========================


def _get_user_from_token(request):
    """Resolve user from 'Authorization: Token <key>' header."""
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Token '):
        return None
    token_key = auth_header.split(' ', 1)[1].strip()
    try:
        from rest_framework.authtoken.models import Token
        token = Token.objects.select_related('user').get(key=token_key)
        if token.user.is_active:
            return token.user
    except Token.DoesNotExist:
        pass
    return None


def _resolve_request_user(request):
    """Returns authenticated user via session OR token, else None."""
    if request.user.is_authenticated:
        return request.user
    return _get_user_from_token(request)


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


def _call_gemini(text: str, action: str, api_key: str, model_name: str = '') -> str:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    system = SYSTEM_PROMPTS.get(action, SYSTEM_PROMPTS['Enhance'])
    model = genai.GenerativeModel(
        model_name=model_name or 'gemini-2.5-flash',
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


def _call_groq(text: str, action: str, api_key: str, model_name: str = '') -> str:
    import urllib.request
    import urllib.error
    import json as _json

    m = model_name or 'llama-3.3-70b-versatile'
    system = SYSTEM_PROMPTS.get(action, SYSTEM_PROMPTS['Enhance'])
    payload = _json.dumps({
        'model': m,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': text},
        ],
        'temperature': 0.9 if action == 'Creative' else 0.7,
        'max_tokens': 4096,
    }).encode()

    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=payload,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = _json.loads(resp.read())
        return data['choices'][0]['message']['content'].strip()
    except urllib.error.HTTPError as e:
        body = _json.loads(e.read())
        msg = body.get('error', {}).get('message', f'Groq API error {e.code}')
        if e.code == 401:
            raise ValueError('Invalid Groq API key.')
        if e.code == 429:
            raise ValueError('Groq rate limit reached. Try again in a moment.')
        raise ValueError(msg)


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
    """BYOK enhancement endpoint — accepts user's own api_key + provider in the request body."""
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
        user_api_key = data.get('api_key', '').strip()
        provider = data.get('provider', 'gemini').lower()
        model = data.get('model', '').strip()
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request body'}, status=400)

    if not text:
        return JsonResponse({'error': 'No text provided'}, status=400)
    if len(text) > 10000:
        return JsonResponse({'error': 'Text too long (max 10 000 chars)'}, status=400)

    # BYOK: use user's key if provided, otherwise fall back to server Gemini key
    if user_api_key:
        api_key = user_api_key
    elif provider == 'gemini':
        api_key = config('GEMINI_API_KEY', default='')
        if not api_key or api_key == 'your-gemini-api-key-here':
            return JsonResponse(
                {'error': 'No API key provided. Add your api_key to the request body.'},
                status=400,
            )
    else:
        return JsonResponse(
            {'error': f'API key required for provider "{provider}". Add your api_key to the request body.'},
            status=400,
        )

    try:
        if provider == 'groq':
            result = _call_groq(text, action, api_key, model)
            resolved_model = model or 'llama-3.3-70b-versatile'
        else:
            result = _call_gemini(text, action, api_key, model)
            resolved_model = model or 'gemini-2.5-flash'

        invite.total_uses += 1
        invite.last_used_at = timezone.now()
        invite.save(update_fields=['total_uses', 'last_used_at'])

        EnhancementLog.objects.create(
            invite_code=invite,
            action=action,
            provider=provider,
            model_used=resolved_model,
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


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def verify_key(request):
    """Validate a user-supplied API key with a lightweight models-list check (no generation cost)."""
    if request.method == 'OPTIONS':
        return JsonResponse({})

    try:
        data = json.loads(request.body)
        api_key = data.get('api_key', '').strip()
        provider = data.get('provider', 'gemini').lower()
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'valid': False, 'error': 'Invalid request'}, status=400)

    if not api_key:
        return JsonResponse({'valid': False, 'error': 'api_key is required'}, status=400)

    import urllib.request as _req
    import urllib.error as _err

    try:
        if provider == 'groq':
            req = _req.Request(
                'https://api.groq.com/openai/v1/models',
                headers={'Authorization': f'Bearer {api_key}'},
                method='GET',
            )
        else:
            req = _req.Request(
                f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}',
                method='GET',
            )
        with _req.urlopen(req, timeout=10) as resp:
            resp.read()
        return JsonResponse({'valid': True, 'provider': provider})
    except _err.HTTPError as e:
        if e.code in (400, 401, 403):
            return JsonResponse({'valid': False, 'error': 'Invalid API key'})
        return JsonResponse({'valid': False, 'error': f'Provider returned {e.code}'})
    except Exception as exc:
        return JsonResponse({'valid': False, 'error': str(exc)})


# ======================== ADMIN API VIEWS ========================


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def admin_enhance_api(request):
    """Quick enhancement endpoint for admin dashboard. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

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
            user=user,
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
@require_http_methods(['POST', 'OPTIONS'])
def admin_generate_invite(request):
    """Generate a new invite code. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

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


@csrf_exempt
@require_http_methods(['GET', 'OPTIONS'])
def admin_invites_data(request):
    """Return invite codes as JSON for admin dashboard. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

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

    now = timezone.now()
    today = now.date()
    week_ago = today - timezone.timedelta(days=7)
    month_ago = today - timezone.timedelta(days=30)

    total = EnhancementLog.objects.count()
    today_count = EnhancementLog.objects.filter(created_at__date=today).count()
    week_count = EnhancementLog.objects.filter(created_at__date__gte=week_ago).count()
    month_count = EnhancementLog.objects.filter(created_at__date__gte=month_ago).count()
    avg_per_day = round(month_count / 30, 1) if month_count else 0

    by_action_qs = (
        EnhancementLog.objects.values('action')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    by_action_data = [
        {'name': r['action'], 'count': r['count'], 'pct': round(r['count'] / total * 100) if total else 0}
        for r in by_action_qs
    ]

    by_provider_qs = EnhancementLog.objects.values('provider').annotate(count=Count('id'))
    by_provider = {r['provider']: r['count'] for r in by_provider_qs}

    top_domains = list(
        EnhancementLog.objects.exclude(domain='')
        .values('domain')
        .annotate(count=Count('id'))
        .order_by('-count')[:8]
    )

    recent = EnhancementLog.objects.select_related('invite_code', 'user').order_by('-created_at')[:20]

    invite_count = InviteCode.objects.filter(is_active=True).count()
    invite_total = InviteCode.objects.count()

    gemini_key = config('GEMINI_API_KEY', default='')
    api_key_configured = bool(gemini_key) and gemini_key != 'your-gemini-api-key-here'

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


# ======================== JSON AUTH API (for React frontend) ========================


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def api_login(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request'}, status=400)

    user_obj = User.objects.filter(email=email).first()
    user = authenticate(request, username=user_obj.username if user_obj else '', password=password) if user_obj else None

    if not user or not user.is_active:
        return JsonResponse({'error': 'Invalid email or password'}, status=401)

    if not user.is_staff:
        return JsonResponse({'error': 'This web login is for administrators only. Use the Chrome extension with your invite code.'}, status=403)

    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)

    return JsonResponse({
        'token': token.key,
        'user': {
            'id': user.id,
            'name': user.first_name or user.username,
            'email': user.email,
            'is_staff': user.is_staff,
        }
    })


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def api_logout(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _get_user_from_token(request)
    if user:
        from rest_framework.authtoken.models import Token
        Token.objects.filter(user=user).delete()
    return JsonResponse({'success': True})


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def api_register(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    try:
        data = json.loads(request.body)
        invite_code_str = data.get('invite_code', '').strip()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request'}, status=400)

    invite = _resolve_invite(invite_code_str)
    if not invite:
        return JsonResponse({'error': 'Invalid or expired invite code'}, status=400)
    if not all([name, email, password]):
        return JsonResponse({'error': 'All fields are required'}, status=400)
    if len(password) < 8:
        return JsonResponse({'error': 'Password must be at least 8 characters'}, status=400)
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'An account with this email already exists'}, status=400)

    username = f"{email.split('@')[0]}_{secrets.token_hex(3)}"
    user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
    UserProfile.objects.create(user=user, invite_code=invite)

    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)

    return JsonResponse({
        'token': token.key,
        'user': {'id': user.id, 'name': user.first_name, 'email': user.email, 'is_staff': user.is_staff}
    })


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def api_request_access(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        reason = data.get('reason', '').strip()
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid request'}, status=400)

    if not email:
        return JsonResponse({'error': 'Email address is required'}, status=400)

    if AccessRequest.objects.filter(email=email).exists():
        return JsonResponse({
            'already_submitted': True,
            'message': "We already have your request! We'll email you once approved.",
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
                f'Approve at:\n'
                f'{getattr(settings, "BACKEND_URL", "")}/admin/prompt_engine/accessrequest/'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'message': f"Request submitted! We'll send your invite code to {email} once approved.",
    })


@require_http_methods(['GET'])
def api_me(request):
    user = _get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    return JsonResponse({
        'user': {'id': user.id, 'name': user.first_name or user.username, 'email': user.email, 'is_staff': user.is_staff}
    })


@csrf_exempt
@require_http_methods(['GET', 'OPTIONS'])
def api_dashboard_stats(request):
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _get_user_from_token(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

    now = timezone.now()
    today = now.date()
    week_ago = today - timezone.timedelta(days=7)
    month_ago = today - timezone.timedelta(days=30)

    total = EnhancementLog.objects.count()
    today_count = EnhancementLog.objects.filter(created_at__date=today).count()
    week_count = EnhancementLog.objects.filter(created_at__date__gte=week_ago).count()
    month_count = EnhancementLog.objects.filter(created_at__date__gte=month_ago).count()
    avg_per_day = round(month_count / 30, 1) if month_count else 0

    by_action_qs = (
        EnhancementLog.objects.values('action')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    by_action_data = [
        {'name': r['action'], 'count': r['count'], 'pct': round(r['count'] / total * 100) if total else 0}
        for r in by_action_qs
    ]

    by_provider_qs = EnhancementLog.objects.values('provider').annotate(count=Count('id'))
    by_provider = {r['provider']: r['count'] for r in by_provider_qs}

    top_domains = list(
        EnhancementLog.objects.exclude(domain='')
        .values('domain')
        .annotate(count=Count('id'))
        .order_by('-count')[:8]
    )

    recent = list(
        EnhancementLog.objects.order_by('-created_at')[:20].values(
            'action', 'provider', 'model_used', 'domain',
            'original_char_count', 'enhanced_char_count', 'created_at',
        )
    )

    gemini_key = config('GEMINI_API_KEY', default='')
    api_key_configured = bool(gemini_key) and gemini_key != 'your-gemini-api-key-here'

    return JsonResponse({
        'user': {'name': user.first_name or user.username, 'email': user.email},
        'stats': {'total': total, 'today': today_count, 'week': week_count, 'month': month_count, 'avg_per_day': avg_per_day},
        'by_action': by_action_data,
        'by_provider': by_provider,
        'top_domains': top_domains,
        'recent': recent,
        'invite_count': InviteCode.objects.filter(is_active=True).count(),
        'invite_total': InviteCode.objects.count(),
        'api_key_configured': api_key_configured,
        'backend_url': getattr(settings, 'BACKEND_URL', 'http://localhost:8000'),
    }, json_dumps_params={'default': str})


# ======================== HEALTH CHECK ========================


@require_http_methods(['GET'])
def health_check(request):
    """Lightweight liveness probe — used by Render and keep-alive pings."""
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'ok', 'db': 'ok'})
    except Exception as exc:
        return JsonResponse({'status': 'error', 'db': str(exc)}, status=503)
