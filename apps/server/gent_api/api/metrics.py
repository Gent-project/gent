"""
Custom Prometheus metrics for authentication and business events.
These metrics track user authentication activities and can be visualized in Grafana.
"""

from prometheus_client import Counter


# Authentication metrics
user_registration_counter = Counter(
    'gent_user_registrations_total',
    'Total user registrations',
    ['status']  # success, failure
)

user_login_counter = Counter(
    'gent_user_logins_total',
    'Total login attempts',
    ['status']  # success, failure, disabled
)

user_logout_counter = Counter(
    'gent_user_logouts_total',
    'Total logout events',
    ['status']  # success, failure
)

token_refresh_counter = Counter(
    'gent_token_refreshes_total',
    'Total token refresh attempts',
    ['status']  # success, failure
)

repository_creation_counter = Counter(
    'gent_repository_creations_total',
    'Total repository creations',
    ['status']  # success, failure
)

commit_creation_counter = Counter(
    'gent_commit_creations_total',
    'Total commit creations',
    ['status']  # success, failure
)

repository_deletion_counter = Counter(
    'gent_repository_deletions_total',
    'Total repository deletions',
    ['status']  # success, failure
)


# Helper functions for easy instrumentation
def track_registration(success: bool):
    """Track user registration event."""
    status = 'success' if success else 'failure'
    user_registration_counter.labels(status=status).inc()


def track_login(status: str):
    """
    Track user login attempt.

    Args:
        status: One of 'success', 'failure', 'disabled'
    """
    user_login_counter.labels(status=status).inc()


def track_logout(success: bool):
    """Track user logout event."""
    status = 'success' if success else 'failure'
    user_logout_counter.labels(status=status).inc()


def track_token_refresh(success: bool):
    """Track JWT token refresh attempt."""
    status = 'success' if success else 'failure'
    token_refresh_counter.labels(status=status).inc()


def track_repository_creation(success: bool):
    """Track repository creation event."""
    status = 'success' if success else 'failure'
    repository_creation_counter.labels(status=status).inc()


def track_commit_creation(success: bool):
    """Track commit creation event."""
    status = 'success' if success else 'failure'
    commit_creation_counter.labels(status=status).inc()


def track_repository_deletion(success: bool):
    """Track repository deletion event."""
    status = 'success' if success else 'failure'
    repository_deletion_counter.labels(status=status).inc()
