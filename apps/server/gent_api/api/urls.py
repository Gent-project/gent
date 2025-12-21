from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('', views.api_root, name='api-root'),

    # Authentication endpoints
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/profile/', views.profile, name='profile'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Repository endpoints
    path('repos/', views.repository_list, name='repository-list'),
    path('repos/create/', views.repository_create, name='repository-create'),
    path('repos/<int:owner_id>/<str:repo_name>/', views.repository_detail, name='repository-detail'),
    path('repos/<int:owner_id>/<str:repo_name>/delete/', views.repository_delete, name='repository-delete'),

    # Branch endpoints
    path('repos/<int:owner_id>/<str:repo_name>/branches/', views.branch_list, name='branch-list'),
    path('repos/<int:owner_id>/<str:repo_name>/branches/create/', views.branch_create, name='branch-create'),
    path('repos/<int:owner_id>/<str:repo_name>/branches/<str:branch_name>/', views.branch_detail, name='branch-detail'),

    # Commit endpoints
    path('repos/<int:owner_id>/<str:repo_name>/commits/', views.commit_list, name='commit-list'),
    path('repos/<int:owner_id>/<str:repo_name>/commits/create/', views.commit_create, name='commit-create'),
    path('repos/<int:owner_id>/<str:repo_name>/commits/<str:sha>/', views.commit_detail, name='commit-detail'),

    # Object endpoints
    path('repos/<int:owner_id>/<str:repo_name>/tree/create/', views.tree_create, name='tree-create'),
    path('repos/<int:owner_id>/<str:repo_name>/tree/<str:sha>/', views.tree_detail, name='tree-detail'),
    path('repos/<int:owner_id>/<str:repo_name>/blob/create/', views.blob_create, name='blob-create'),
    path('repos/<int:owner_id>/<str:repo_name>/blob/<str:sha>/', views.blob_detail, name='blob-detail'),
]
