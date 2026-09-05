import logging

import resend
from django.conf import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(user, reset_url):
    """Send a password reset email via Resend.

    Raises on failure so the caller can log it. The caller must still return a
    generic success response to avoid leaking which emails have accounts.
    """
    subject = 'Reset your Gent password'
    html_body = (
        f'<p>Hi,</p>'
        f'<p>You requested a password reset for your Gent account '
        f'({user.email}).</p>'
        f'<p><a href="{reset_url}">Reset your password</a></p>'
        f'<p>If you did not request this, you can ignore this email.</p>'
    )

    if not settings.RESEND_API_KEY:
        if settings.DEBUG:
            logger.warning(
                'RESEND_API_KEY not set; password reset URL for %s: %s',
                user.email,
                reset_url,
            )
            return
        logger.error(
            'RESEND_API_KEY is not set; cannot send password reset email to %s',
            user.email,
        )
        raise RuntimeError('RESEND_API_KEY is not configured')

    resend.api_key = settings.RESEND_API_KEY
    try:
        result = resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [user.email],
            'subject': subject,
            'html': html_body,
        })
    except Exception:
        logger.exception(
            'Failed to send password reset email from %s to %s',
            settings.DEFAULT_FROM_EMAIL,
            user.email,
        )
        raise

    logger.info(
        'Password reset email sent to %s (resend id=%s)',
        user.email,
        (result or {}).get('id'),
    )
