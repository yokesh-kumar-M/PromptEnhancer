from django.db import models
from django.contrib.auth.models import User
import secrets


class PromptTemplate(models.Model):
    title = models.CharField(max_length=255)
    shortcut = models.CharField(max_length=50, unique=True, help_text="e.g., //refactor")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class InviteCode(models.Model):
    code = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=100, blank=True, help_text="Who this code is for (e.g., 'John Smith')")
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    total_uses = models.IntegerField(default=0)
    max_uses = models.IntegerField(default=0, help_text="0 = unlimited")
    invite_sent = models.BooleanField(default=False)
    invite_sent_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def generate_for(cls, email: str, label: str = '', max_uses: int = 0):
        return cls.objects.create(
            code=secrets.token_urlsafe(16),
            email=email,
            label=label,
            max_uses=max_uses,
        )

    def __str__(self):
        return f"{self.code} — {self.label or self.email or 'unlabeled'}"


class AccessRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100, blank=True)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    invite_code = models.ForeignKey(InviteCode, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.email} ({self.get_status_display()})"


class UserProfile(models.Model):
    PROVIDER_GROQ = 'groq'
    PROVIDER_GEMINI = 'gemini'
    PROVIDER_CHOICES = [
        (PROVIDER_GROQ, 'Groq'),
        (PROVIDER_GEMINI, 'Google Gemini'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    invite_code = models.ForeignKey(InviteCode, on_delete=models.SET_NULL, null=True, blank=True)
    preferred_provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_GEMINI)
    total_enhancements = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}'s profile"


class EnhancementLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='enhancements'
    )
    invite_code = models.ForeignKey(InviteCode, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)
    provider = models.CharField(max_length=20, default='gemini')
    model_used = models.CharField(max_length=100, blank=True)
    original_char_count = models.IntegerField(default=0)
    enhanced_char_count = models.IntegerField(default=0)
    domain = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} by {self.user or 'anon'} at {self.created_at:%Y-%m-%d %H:%M}"
