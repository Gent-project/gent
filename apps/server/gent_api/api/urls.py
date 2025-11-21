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
]
