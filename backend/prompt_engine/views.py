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


def _find_invite(code: str):
    """Returns InviteCode if active (for logging backwards compat)."""
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
def enhance_prompt(request):
    """BYOK enhancement endpoint — no invite code required. Supply your own api_key."""
    if request.method == 'OPTIONS':
        return JsonResponse({})

    user = _resolve_request_user(request)

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
        return JsonResponse({'error': 'Text too long (max 10,000 chars)'}, status=400)

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

        # Optional: track invite code for logging backwards compat
        invite_code_str = request.headers.get('X-Invite-Code', '').strip()
        invite = _find_invite(invite_code_str) if invite_code_str else None

        if invite:
            invite.total_uses += 1
            invite.last_used_at = timezone.now()
            invite.save(update_fields=['total_uses', 'last_used_at'])

        EnhancementLog.objects.create(
            user=user,
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

    # Try to resolve user from token
    user = _resolve_request_user(request)

    # Also try invite code for backwards compat
    invite_code_str = data.get('invite_code', '').strip()
    invite = _find_invite(invite_code_str) if invite_code_str else None

    if invite and not user:
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
    """Validate a user-supplied API key with a lightweight models-list check."""
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
@require_http_methods(['GET', 'OPTIONS'])
def admin_access_requests(request):
    """List all access requests. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

    requests_qs = AccessRequest.objects.order_by('-requested_at')[:100].values(
        'id', 'email', 'name', 'reason', 'status', 'requested_at', 'processed_at'
    )
    return JsonResponse({'requests': list(requests_qs)}, json_dumps_params={'default': str})


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def admin_approve_request(request, pk):
    """Approve an access request — creates user account and emails credentials. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

    try:
        access_req = AccessRequest.objects.get(pk=pk)
    except AccessRequest.DoesNotExist:
        return JsonResponse({'error': 'Request not found'}, status=404)

    if access_req.status == AccessRequest.STATUS_APPROVED:
        return JsonResponse({'error': 'Already approved'}, status=400)

    # If user already exists, just mark as approved
    existing_user = User.objects.filter(email=access_req.email).first()
    if existing_user:
        access_req.status = AccessRequest.STATUS_APPROVED
        access_req.processed_at = timezone.now()
        access_req.save()
        return JsonResponse({'success': True, 'message': f'Approved — account already exists for {access_req.email}'})

    # Create user account with temp password
    temp_password = secrets.token_urlsafe(10)
    username = f"{access_req.email.split('@')[0]}_{secrets.token_hex(3)}"
    new_user = User.objects.create_user(
        username=username,
        email=access_req.email,
        password=temp_password,
        first_name=access_req.name or '',
        is_active=True,
    )
    UserProfile.objects.get_or_create(user=new_user)

    from rest_framework.authtoken.models import Token
    Token.objects.get_or_create(user=new_user)

    access_req.status = AccessRequest.STATUS_APPROVED
    access_req.processed_at = timezone.now()
    access_req.save()

    # Send welcome email with credentials
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://promptenhancer-frontend.vercel.app')
    backend_url = getattr(settings, 'BACKEND_URL', 'https://promptenhancer-backend.onrender.com')
    try:
        send_mail(
            subject='PromptEnhancer Pro — Your Access Has Been Approved!',
            message=(
                f"Hi {access_req.name or 'there'},\n\n"
                f"Great news! Your access to PromptEnhancer Pro has been approved.\n\n"
                f"Your login credentials:\n"
                f"  Email:    {access_req.email}\n"
                f"  Password: {temp_password}\n\n"
                f"Login at: {frontend_url}/login\n\n"
                f"To use the Chrome Extension:\n"
                f"1. Install from GitHub Releases: https://github.com/yokesh-kumar-M/PromptEnhancer/releases\n"
                f"2. Open the extension → Settings tab\n"
                f"3. Set Backend URL to: {backend_url}\n"
                f"4. Add your free Groq or Gemini API key\n"
                f"5. Click ✨ on any AI chat to enhance your prompts!\n\n"
                f"Free API keys:\n"
                f"  Groq (ultra-fast, 14,400 req/day): https://console.groq.com/keys\n"
                f"  Google Gemini (free):               https://aistudio.google.com/apikey\n\n"
                f"Welcome to PromptEnhancer Pro!\n"
                f"— Yokesh"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[access_req.email],
            fail_silently=True,
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'message': f'Approved! Credentials emailed to {access_req.email}',
    })


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def admin_reject_request(request, pk):
    """Reject an access request. Staff only."""
    if request.method == 'OPTIONS':
        return JsonResponse({})
    user = _resolve_request_user(request)
    if not user or not user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)

    try:
        access_req = AccessRequest.objects.get(pk=pk)
    except AccessRequest.DoesNotExist:
        return JsonResponse({'error': 'Request not found'}, status=404)

    access_req.status = AccessRequest.STATUS_REJECTED
    access_req.processed_at = timezone.now()
    access_req.save()

    return JsonResponse({'success': True, 'message': f'Rejected request from {access_req.email}'})


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
                'message': "We already have your request! You'll receive an email once approved.",
            })

        AccessRequest.objects.create(email=email, name=name, reason=reason)

        admin_email = getattr(settings, 'ADMIN_EMAIL', 'yokeshkumar1704@gmail.com')
        try:
            send_mail(
                subject=f'[PromptEnhancer] New access request from {name or email}',
                message=(
                    f'Name: {name or "(not provided)"}\n'
                    f'Email: {email}\n'
                    f'Reason: {reason or "(not provided)"}\n\n'
                    f'Approve in admin dashboard:\n'
                    f'https://promptenhancer-frontend.vercel.app/dashboard'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin_email],
                fail_silently=True,
            )
        except Exception:
            pass

        return render(request, 'request_access.html', {
            'submitted': True,
            'message': f"Request submitted! You'll receive login credentials at {email} once approved.",
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
    """Registration is handled by admin approval. Redirect to request access."""
    return redirect('request_access')


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

    pending_requests = AccessRequest.objects.filter(status=AccessRequest.STATUS_PENDING).count()
    total_requests = AccessRequest.objects.count()

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
        'pending_requests': pending_requests,
        'total_requests': total_requests,
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

    # Auto-promote the admin email to staff/superuser on every login (belt and suspenders)
    admin_email = getattr(settings, 'ADMIN_EMAIL', 'yokeshkumar1704@gmail.com')
    if user.email.lower() == admin_email.lower():
        needs_save = []
        if not user.is_staff:
            user.is_staff = True
            needs_save.append('is_staff')
        if not user.is_superuser:
            user.is_superuser = True
            needs_save.append('is_superuser')
        if needs_save:
            user.save(update_fields=needs_save)

    if not user.is_staff:
        return JsonResponse({'error': 'Admin access only. Contact the admin if you need access.'}, status=403)

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
            'message': "We already have your request! You'll receive an email once the admin approves it.",
        })

    AccessRequest.objects.create(email=email, name=name, reason=reason)

    admin_email = getattr(settings, 'ADMIN_EMAIL', 'yokeshkumar1704@gmail.com')
    try:
        send_mail(
            subject=f'[PromptEnhancer] New access request from {name or email}',
            message=(
                f'Name: {name or "(not provided)"}\n'
                f'Email: {email}\n'
                f'Reason: {reason or "(not provided)"}\n\n'
                f'Review and approve at:\n'
                f'https://promptenhancer-frontend.vercel.app/dashboard'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'message': f"Request submitted! You'll receive login credentials at {email} once approved.",
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

    pending_requests = AccessRequest.objects.filter(status=AccessRequest.STATUS_PENDING).count()
    total_requests = AccessRequest.objects.count()

    gemini_key = config('GEMINI_API_KEY', default='')
    api_key_configured = bool(gemini_key) and gemini_key != 'your-gemini-api-key-here'

    return JsonResponse({
        'user': {'name': user.first_name or user.username, 'email': user.email},
        'stats': {'total': total, 'today': today_count, 'week': week_count, 'month': month_count, 'avg_per_day': avg_per_day},
        'by_action': by_action_data,
        'by_provider': by_provider,
        'top_domains': top_domains,
        'recent': recent,
        'pending_requests': pending_requests,
        'total_requests': total_requests,
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
