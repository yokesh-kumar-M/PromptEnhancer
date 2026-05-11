from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prompt_engine', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='InviteCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True)),
                ('label', models.CharField(blank=True, help_text="Who this code is for (e.g., 'John Smith')", max_length=100)),
                ('email', models.EmailField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('total_uses', models.IntegerField(default=0)),
                ('max_uses', models.IntegerField(default=0, help_text='0 = unlimited')),
            ],
        ),
    ]
