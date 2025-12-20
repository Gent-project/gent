from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('', views.api_root, name='api-root'),

    # Health check
    path('health/', views.health_check, name='health-check'),

    # Authentication endpoints
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/profile/', views.profile, name='profile'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Repository endpoints
    path('repositories/', views.repository_list, name='repository-list'),
    path('repositories/<int:pk>/', views.repository_detail, name='repository-detail'),

    # Commit endpoints
    path('repositories/<int:repository_pk>/commits/', views.commit_list, name='commit-list'),
    path('repositories/<int:repository_pk>/commits/<int:pk>/', views.commit_detail, name='commit-detail'),
]
