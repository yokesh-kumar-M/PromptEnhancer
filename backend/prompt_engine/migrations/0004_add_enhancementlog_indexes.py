from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prompt_engine', '0003_enterprise_models'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='enhancementlog',
            index=models.Index(fields=['created_at'], name='prompt_engi_created_3d8b2e_idx'),
        ),
        migrations.AddIndex(
            model_name='enhancementlog',
            index=models.Index(fields=['action'], name='prompt_engi_action_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='enhancementlog',
            index=models.Index(fields=['provider'], name='prompt_engi_provide_d4e5f6_idx'),
        ),
    ]
