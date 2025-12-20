from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Repository, Commit


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for custom User model."""
    list_display = ['email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined']
    list_filter = ['is_staff', 'is_active', 'date_joined']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['email']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'first_name', 'last_name'),
        }),
    )


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    """Admin interface for Repository model."""
    list_display = ['name', 'owner', 'is_private', 'created_at', 'updated_at']
    list_filter = ['is_private', 'created_at']
    search_fields = ['name', 'owner__email', 'description']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Commit)
class CommitAdmin(admin.ModelAdmin):
    """Admin interface for Commit model."""
    list_display = ['short_hash', 'message_preview', 'author', 'repository', 'created_at']
    list_filter = ['created_at', 'repository']
    search_fields = ['hash', 'message', 'author__email', 'repository__name']
    ordering = ['-created_at']
    readonly_fields = ['hash', 'created_at']

    def short_hash(self, obj):
        """Display shortened commit hash."""
        return obj.hash[:7]
    short_hash.short_description = 'Hash'

    def message_preview(self, obj):
        """Display truncated commit message."""
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_preview.short_description = 'Message'
