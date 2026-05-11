from django.contrib import admin
from django.urls import include, path

from prompt_engine import views as web_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('prompt_engine.urls')),

    # Web views
    path('', web_views.landing_view, name='landing'),
    path('request-access/', web_views.request_access_view, name='request_access'),
    path('login/', web_views.login_view, name='login'),
    path('logout/', web_views.logout_view, name='logout'),
    path('register/', web_views.register_view, name='register'),
    path('dashboard/', web_views.dashboard_view, name='dashboard'),
]
