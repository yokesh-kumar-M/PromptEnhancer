from django.conf import settings
from django.contrib import admin
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


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'label', 'email', 'is_active', 'total_uses', 'max_uses', 'invite_sent', 'last_used_at', 'created_at']
    list_filter = ['is_active', 'invite_sent']
    readonly_fields = ['created_at', 'last_used_at', 'total_uses', 'invite_sent_at']
    search_fields = ['code', 'label', 'email']
    actions = ['activate_codes', 'deactivate_codes', 'send_invite_emails']

    def get_changeform_initial_data(self, request):
        import secrets as _secrets
        return {'code': _secrets.token_urlsafe(16)}

    def save_model(self, request, obj, form, change):
        import secrets as _secrets
        if not obj.code:
            obj.code = _secrets.token_urlsafe(16)
        super().save_model(request, obj, form, change)

    def activate_codes(self, request, queryset):
        queryset.update(is_active=True)
    activate_codes.short_description = 'Activate selected codes'

    def deactivate_codes(self, request, queryset):
        queryset.update(is_active=False)
    deactivate_codes.short_description = 'Deactivate selected codes'

    def send_invite_emails(self, request, queryset):
        sent = 0
        backend_url = getattr(settings, 'BACKEND_URL', 'https://your-app.railway.app')
        for code in queryset:
            if not code.email:
                self.message_user(request, f'Skipped {code.code}: no email set.', level='warning')
                continue
            register_url = f"{backend_url}/register/?code={code.code}"
            try:
                send_mail(
                    subject="You're invited to PromptEnhancer Pro!",
                    message=(
                        f"Hi {code.label or 'there'},\n\n"
                        f"You've been invited to PromptEnhancer Pro — a powerful AI prompt enhancement tool.\n\n"
                        f"Your invite code: {code.code}\n"
                        f"Register here: {register_url}\n\n"
                        f"What you get:\n"
                        f"• Chrome extension that enhances prompts on ChatGPT, Claude, Gemini & more\n"
                        f"• VS Code extension for coding prompts\n"
                        f"• 5 enhancement modes (Enhance, Professional, Shorten, Code, Creative)\n"
                        f"• BYOK — use your own free Groq or Gemini API key\n\n"
                        f"Get your free API key:\n"
                        f"• Groq (fastest): https://console.groq.com/keys\n"
                        f"• Gemini: https://aistudio.google.com/apikey\n\n"
                        f"Welcome aboard!\n— Yokesh"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[code.email],
                    fail_silently=False,
                )
                code.invite_sent = True
                code.invite_sent_at = timezone.now()
                code.save(update_fields=['invite_sent', 'invite_sent_at'])
                sent += 1
            except Exception as exc:
                self.message_user(request, f'Failed to send to {code.email}: {exc}', level='error')
        if sent:
            self.message_user(request, f'Sent {sent} invite email(s) successfully.')
    send_invite_emails.short_description = 'Send invite email to selected codes'


@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ['email', 'name', 'status', 'requested_at', 'processed_at', 'invite_code']
    list_filter = ['status']
    search_fields = ['email', 'name']
    readonly_fields = ['requested_at', 'processed_at']
    ordering = ['-requested_at']
    actions = ['approve_and_send_invite', 'reject_requests']

    def approve_and_send_invite(self, request, queryset):
        approved = 0
        backend_url = getattr(settings, 'BACKEND_URL', 'https://your-app.railway.app')
        for access_req in queryset:
            if access_req.status == AccessRequest.STATUS_APPROVED:
                self.message_user(request, f'{access_req.email} already approved.', level='warning')
                continue

            invite = InviteCode.generate_for(
                email=access_req.email,
                label=access_req.name or access_req.email,
                max_uses=0,
            )
            access_req.status = AccessRequest.STATUS_APPROVED
            access_req.processed_at = timezone.now()
            access_req.invite_code = invite
            access_req.save()

            register_url = f"{backend_url}/register/?code={invite.code}"
            try:
                send_mail(
                    subject="You're invited to PromptEnhancer Pro!",
                    message=(
                        f"Hi {access_req.name or 'there'},\n\n"
                        f"Great news — your access request has been approved!\n\n"
                        f"Your invite code: {invite.code}\n"
                        f"Create your account: {register_url}\n\n"
                        f"Getting started:\n"
                        f"1. Register using the link above\n"
                        f"2. Install the Chrome extension (link in your dashboard)\n"
                        f"3. Open the extension → Settings → add your API key\n"
                        f"4. Click ✨ on any AI chat to enhance your prompts!\n\n"
                        f"Free API keys:\n"
                        f"• Groq (ultra-fast): https://console.groq.com/keys\n"
                        f"• Google Gemini: https://aistudio.google.com/apikey\n\n"
                        f"Welcome to PromptEnhancer Pro!\n— Yokesh"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[access_req.email],
                    fail_silently=False,
                )
                invite.invite_sent = True
                invite.invite_sent_at = timezone.now()
                invite.save(update_fields=['invite_sent', 'invite_sent_at'])
                approved += 1
            except Exception as exc:
                self.message_user(request, f'Failed to email {access_req.email}: {exc}', level='error')

        if approved:
            self.message_user(request, f'Approved and emailed {approved} invite(s).')
    approve_and_send_invite.short_description = 'Approve and send invite code by email'

    def reject_requests(self, request, queryset):
        queryset.update(status=AccessRequest.STATUS_REJECTED, processed_at=timezone.now())
        self.message_user(request, f'Rejected {queryset.count()} request(s).')
    reject_requests.short_description = 'Reject selected requests'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'preferred_provider', 'total_enhancements', 'invite_code', 'created_at']
    list_filter = ['preferred_provider']
    search_fields = ['user__username', 'user__email', 'user__first_name']
    readonly_fields = ['created_at', 'total_enhancements']


@admin.register(EnhancementLog)
class EnhancementLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'provider', 'model_used', 'domain', 'original_char_count', 'enhanced_char_count', 'invite_code', 'created_at']
    list_filter = ['action', 'provider']
    search_fields = ['domain', 'invite_code__email', 'user__email']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
