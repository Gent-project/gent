import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def send_password_reset_email(user, reset_url):
    """Send a password reset email over SMTP.

    Raises on failure so the caller can log it. The caller must still return a
    generic success response to avoid leaking which emails have accounts.
    """
    subject = 'Reset your Gent password'
    text_body = (
        'Hi,\n\n'
        f'You requested a password reset for your Gent account ({user.email}).\n\n'
        f'Open this link to choose a new password:\n{reset_url}\n\n'
        'If you did not request this, you can ignore this email.\n'
    )
    html_body = (
        f'<p>Hi,</p>'
        f'<p>You requested a password reset for your Gent account '
        f'({user.email}).</p>'
        f'<p><a href="{reset_url}">Reset your password</a></p>'
        f'<p>If you did not request this, you can ignore this email.</p>'
    )

    if not settings.EMAIL_HOST:
        if settings.DEBUG:
            logger.warning(
                'EMAIL_HOST not set; password reset URL for %s: %s',
                user.email,
                reset_url,
            )
            return
        logger.error(
            'EMAIL_HOST is not set; cannot send password reset email to %s',
            user.email,
        )
        raise RuntimeError('EMAIL_HOST is not configured')

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, 'text/html')

    try:
        message.send(fail_silently=False)
    except Exception:
        logger.exception(
            'Failed to send password reset email from %s to %s via %s',
            settings.DEFAULT_FROM_EMAIL,
            user.email,
            settings.EMAIL_HOST,
        )
        raise

    logger.info(
        'Password reset email sent to %s from %s via %s',
        user.email,
        settings.DEFAULT_FROM_EMAIL,
        settings.EMAIL_HOST,
    )
