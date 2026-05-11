from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'templates', views.PromptTemplateViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('enhance/', views.enhance_prompt, name='enhance'),
    path('validate-invite/', views.validate_invite, name='validate-invite'),
    path('log-usage/', views.log_usage, name='log-usage'),
]
