from django.contrib import admin
from django.urls import include, path

from prompt_engine import views as web_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('prompt_engine.urls')),

    # Admin API (dashboard tools)
    path('api/admin/enhance/', web_views.admin_enhance_api, name='admin_enhance'),
    path('api/admin/invite/generate/', web_views.admin_generate_invite, name='admin_generate_invite'),
    path('api/admin/invites/', web_views.admin_invites_data, name='admin_invites'),

    # JSON Auth API (for React frontend)
    path('api/auth/login/', web_views.api_login, name='api_login'),
    path('api/auth/logout/', web_views.api_logout, name='api_logout'),
    path('api/auth/register/', web_views.api_register, name='api_register'),
    path('api/auth/request-access/', web_views.api_request_access, name='api_request_access'),
    path('api/auth/me/', web_views.api_me, name='api_me'),
    path('api/dashboard/stats/', web_views.api_dashboard_stats, name='api_dashboard_stats'),

    # Django template web views (kept for /admin/ login flow)
    path('', web_views.landing_view, name='landing'),
    path('request-access/', web_views.request_access_view, name='request_access'),
    path('login/', web_views.login_view, name='login'),
    path('logout/', web_views.logout_view, name='logout'),
    path('register/', web_views.register_view, name='register'),
    path('dashboard/', web_views.dashboard_view, name='dashboard'),
]
