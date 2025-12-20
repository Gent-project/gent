from sentry_sdk import set_user


class SentryUserContextMiddleware:
    """
    Middleware to attach authenticated user context to Sentry error reports.
    This helps identify which users are experiencing errors.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set user context for Sentry if user is authenticated
        if hasattr(request, 'user') and request.user.is_authenticated:
            set_user({
                "id": str(request.user.id),
                "email": request.user.email,
            })
        else:
            set_user(None)

        response = self.get_response(request)
        return response
