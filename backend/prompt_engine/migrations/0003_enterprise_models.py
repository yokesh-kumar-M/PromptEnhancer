from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('prompt_engine', '0002_invitecode'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='invitecode',
            name='invite_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='invitecode',
            name='invite_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='AccessRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(unique=True)),
                ('name', models.CharField(blank=True, max_length=100)),
                ('reason', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                    default='pending',
                    max_length=20,
                )),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('invite_code', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='prompt_engine.invitecode',
                )),
            ],
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('preferred_provider', models.CharField(
                    choices=[('groq', 'Groq'), ('gemini', 'Google Gemini')],
                    default='gemini',
                    max_length=20,
                )),
                ('total_enhancements', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='profile',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('invite_code', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='prompt_engine.invitecode',
                )),
            ],
        ),
        migrations.CreateModel(
            name='EnhancementLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=50)),
                ('provider', models.CharField(default='gemini', max_length=20)),
                ('model_used', models.CharField(blank=True, max_length=100)),
                ('original_char_count', models.IntegerField(default=0)),
                ('enhanced_char_count', models.IntegerField(default=0)),
                ('domain', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='enhancements',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('invite_code', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='prompt_engine.invitecode',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
