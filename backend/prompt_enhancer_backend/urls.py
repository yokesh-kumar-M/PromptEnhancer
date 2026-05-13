from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from decouple import config

from prompt_engine import views as web_views

FRONTEND_URL = config('FRONTEND_URL', default='https://promptenhancer-frontend.vercel.app')

urlpatterns = [
    # Django admin lives at /_admin/ for emergency DB access
    path('_admin/', admin.site.urls),
    # Old /admin/ URL → React dashboard
    path('admin/', RedirectView.as_view(url=f'{FRONTEND_URL}/dashboard', permanent=False)),

    # All public API endpoints
    path('api/', include('prompt_engine.urls')),

    # Admin API — used by the React dashboard
    path('api/admin/enhance/', web_views.admin_enhance_api, name='admin_enhance'),
    path('api/admin/access-requests/', web_views.admin_access_requests, name='admin_access_requests'),
    path('api/admin/access-requests/<int:pk>/approve/', web_views.admin_approve_request, name='admin_approve_request'),
    path('api/admin/access-requests/<int:pk>/reject/', web_views.admin_reject_request, name='admin_reject_request'),

    # JSON Auth API (for React frontend)
    path('api/auth/login/', web_views.api_login, name='api_login'),
    path('api/auth/logout/', web_views.api_logout, name='api_logout'),
    path('api/auth/request-access/', web_views.api_request_access, name='api_request_access'),
    path('api/auth/me/', web_views.api_me, name='api_me'),
    path('api/dashboard/stats/', web_views.api_dashboard_stats, name='api_dashboard_stats'),
    path('api/health/', web_views.health_check, name='health_check'),

    # Every UI path → React frontend (Vercel)
    path('', RedirectView.as_view(url=FRONTEND_URL, permanent=False)),
    path('login/', RedirectView.as_view(url=f'{FRONTEND_URL}/login', permanent=False)),
    path('logout/', RedirectView.as_view(url=FRONTEND_URL, permanent=False)),
    path('register/', RedirectView.as_view(url=f'{FRONTEND_URL}/request-access', permanent=False)),
    path('request-access/', RedirectView.as_view(url=f'{FRONTEND_URL}/request-access', permanent=False)),
    path('dashboard/', RedirectView.as_view(url=f'{FRONTEND_URL}/dashboard', permanent=False)),
]
