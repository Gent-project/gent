from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.services.email import send_password_reset_email


class _FakeUser:
    """Minimal stand-in so the real send path can be exercised without a User."""

    def __init__(self, email):
        self.email = email


class Command(BaseCommand):
    help = 'Send a test password reset email to check the Resend configuration.'

    def add_arguments(self, parser):
        parser.add_argument('email', help='Recipient address.')

    def handle(self, *args, **options):
        recipient = options['email']
        reset_url = f'{settings.FRONTEND_URL.rstrip("/")}/auth/reset-password?uid=test&token=test'

        self.stdout.write(f'RESEND_API_KEY:     {"set" if settings.RESEND_API_KEY else "NOT SET"}')
        self.stdout.write(f'DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'FRONTEND_URL:       {settings.FRONTEND_URL}')
        self.stdout.write(f'Sending to:         {recipient}')

        try:
            send_password_reset_email(_FakeUser(recipient), reset_url)
        except Exception as exc:
            raise CommandError(f'Send failed: {exc}')

        self.stdout.write(self.style.SUCCESS('Done - see the log line above for the Resend id.'))
