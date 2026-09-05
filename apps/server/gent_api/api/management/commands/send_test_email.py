from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.services.email import send_password_reset_email


class _FakeUser:
    """Minimal stand-in so the real send path can be exercised without a User."""

    def __init__(self, email):
        self.email = email


class Command(BaseCommand):
    help = 'Send a test password reset email to check the SMTP configuration.'

    def add_arguments(self, parser):
        parser.add_argument('email', help='Recipient address.')

    def handle(self, *args, **options):
        recipient = options['email']
        reset_url = f'{settings.FRONTEND_URL.rstrip("/")}/auth/reset-password?uid=test&token=test'

        self.stdout.write(f'EMAIL_HOST:         {settings.EMAIL_HOST or "NOT SET"}')
        self.stdout.write(f'EMAIL_PORT:         {settings.EMAIL_PORT}')
        self.stdout.write(f'EMAIL_HOST_USER:    {settings.EMAIL_HOST_USER or "NOT SET"}')
        self.stdout.write(f'EMAIL_HOST_PASSWORD:{"set" if settings.EMAIL_HOST_PASSWORD else "NOT SET"}')
        self.stdout.write(f'EMAIL_USE_TLS:      {settings.EMAIL_USE_TLS}')
        self.stdout.write(f'DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'FRONTEND_URL:       {settings.FRONTEND_URL}')
        self.stdout.write(f'Sending to:         {recipient}')

        try:
            send_password_reset_email(_FakeUser(recipient), reset_url)
        except Exception as exc:
            raise CommandError(f'Send failed: {exc}')

        self.stdout.write(self.style.SUCCESS(f'Sent to {recipient}. Check the inbox (and spam).'))
