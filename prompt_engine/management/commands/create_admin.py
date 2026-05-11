from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create the Yokesh admin superuser if it does not already exist'

    def handle(self, *args, **options):
        if User.objects.filter(username='yokesh').exists():
            self.stdout.write(self.style.WARNING('Admin user "yokesh" already exists — skipping.'))
            return

        User.objects.create_superuser(
            username='yokesh',
            email='yokeshkumar1704@gmail.com',
            password='ThisisaworkingModel',
            first_name='Yokesh',
        )
        self.stdout.write(self.style.SUCCESS('Superuser "yokesh" created successfully.'))
