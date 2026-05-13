import secrets

from django.conf import settings
from django.contrib import admin
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils import timezone

from .models import AccessRequest, EnhancementLog, InviteCode, PromptTemplate, UserProfile

admin.site.site_header = "PromptEnhancer Pro — Admin Panel"
admin.site.site_title = "PromptEnhancer Admin"
admin.site.index_title = "Welcome, Yokesh"


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ['title', 'shortcut', 'created_at']
    search_fields = ['title', 'shortcut', 'content']


@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ['email', 'name', 'status', 'requested_at', 'processed_at']
    list_filter = ['status']
    search_fields = ['email', 'name']
    readonly_fields = ['requested_at', 'processed_at']
    ordering = ['-requested_at']
    actions = ['approve_and_create_account', 'reject_requests']

    def approve_and_create_account(self, request, queryset):
        approved = 0
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://promptenhancer-frontend.vercel.app')
        backend_url = getattr(settings, 'BACKEND_URL', 'https://promptenhancer-backend.onrender.com')

        for access_req in queryset:
            if access_req.status == AccessRequest.STATUS_APPROVED:
                self.message_user(request, f'{access_req.email} already approved.', level='warning')
                continue

            existing_user = User.objects.filter(email=access_req.email).first()
            if existing_user:
                access_req.status = AccessRequest.STATUS_APPROVED
                access_req.processed_at = timezone.now()
                access_req.save()
                self.message_user(request, f'{access_req.email} approved (account already exists).')
                continue

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

            access_req.status = AccessRequest.STATUS_APPROVED
            access_req.processed_at = timezone.now()
            access_req.save()

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
                        f"  Groq (ultra-fast): https://console.groq.com/keys\n"
                        f"  Google Gemini:     https://aistudio.google.com/apikey\n\n"
                        f"Welcome to PromptEnhancer Pro!\n"
                        f"— Yokesh"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[access_req.email],
                    fail_silently=False,
                )
                approved += 1
            except Exception as exc:
                self.message_user(request, f'Failed to email {access_req.email}: {exc}', level='error')

        if approved:
            self.message_user(request, f'Approved {approved} request(s) and sent credentials by email.')

    approve_and_create_account.short_description = 'Approve and email login credentials'

    def reject_requests(self, request, queryset):
        queryset.update(status=AccessRequest.STATUS_REJECTED, processed_at=timezone.now())
        self.message_user(request, f'Rejected {queryset.count()} request(s).')

    reject_requests.short_description = 'Reject selected requests'


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'label', 'email', 'is_active', 'total_uses', 'created_at']
    list_filter = ['is_active']
    readonly_fields = ['created_at', 'last_used_at', 'total_uses']
    search_fields = ['code', 'label', 'email']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'preferred_provider', 'total_enhancements', 'created_at']
    list_filter = ['preferred_provider']
    search_fields = ['user__username', 'user__email', 'user__first_name']
    readonly_fields = ['created_at', 'total_enhancements']


@admin.register(EnhancementLog)
class EnhancementLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'provider', 'model_used', 'domain', 'original_char_count', 'enhanced_char_count', 'created_at']
    list_filter = ['action', 'provider']
    search_fields = ['domain', 'user__email']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
