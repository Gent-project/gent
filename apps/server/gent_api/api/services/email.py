import logging

import resend
from django.conf import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(user, reset_url):
    """Send a password reset email via Resend, or log the URL in development."""
    subject = 'Reset your Gent password'
    html_body = (
        f'<p>Hi,</p>'
        f'<p>You requested a password reset for your Gent account '
        f'({user.email}).</p>'
        f'<p><a href="{reset_url}">Reset your password</a></p>'
        f'<p>If you did not request this, you can ignore this email.</p>'
    )

    if not settings.RESEND_API_KEY:
        logger.info(
            'RESEND_API_KEY not set; password reset URL for %s: %s',
            user.email,
            reset_url,
        )
        return

    resend.api_key = settings.RESEND_API_KEY
    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [user.email],
            'subject': subject,
            'html': html_body,
        })
    except Exception:
        logger.exception('Failed to send password reset email to %s', user.email)
        raise
