from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create or repair the Yokesh admin superuser'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username='yokesh',
            defaults={
                'email': 'yokeshkumar1704@gmail.com',
                'first_name': 'Yokesh',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            },
        )

        if created:
            user.set_password('ThisisaworkingModel')
            user.save()
            self.stdout.write(self.style.SUCCESS('Superuser "yokesh" created successfully.'))
            return

        # Repair permissions if they drifted
        needs_save = []
        if not user.is_staff:
            user.is_staff = True
            needs_save.append('is_staff')
        if not user.is_superuser:
            user.is_superuser = True
            needs_save.append('is_superuser')
        if not user.is_active:
            user.is_active = True
            needs_save.append('is_active')

        if needs_save:
            user.save(update_fields=needs_save)
            self.stdout.write(self.style.SUCCESS(f'Admin "yokesh" permissions repaired: {needs_save}'))
        else:
            self.stdout.write(self.style.WARNING('Admin user "yokesh" already exists and is healthy.'))
