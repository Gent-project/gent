from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Repository, Branch, Commit, Tree, Blob


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
    list_display = ['name', 'owner', 'is_private', 'default_branch', 'created_at']
    list_filter = ['is_private', 'created_at']
    search_fields = ['name', 'owner__email', 'description']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    """Admin interface for Branch model."""
    list_display = ['name', 'repository', 'commit_sha', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'repository__name', 'commit_sha']
    ordering = ['repository', 'name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Commit)
class CommitAdmin(admin.ModelAdmin):
    """Admin interface for Commit model."""
    list_display = ['sha_short', 'repository', 'author', 'message_short', 'committed_at']
    list_filter = ['committed_at', 'created_at']
    search_fields = ['sha', 'message', 'author__email', 'author_name']
    ordering = ['-committed_at']
    readonly_fields = ['created_at']

    def sha_short(self, obj):
        return obj.sha[:7]
    sha_short.short_description = 'SHA'

    def message_short(self, obj):
        return obj.message[:50]
    message_short.short_description = 'Message'


@admin.register(Tree)
class TreeAdmin(admin.ModelAdmin):
    """Admin interface for Tree model."""
    list_display = ['sha_short', 'repository', 'entry_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['sha', 'repository__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at']

    def sha_short(self, obj):
        return obj.sha[:7]
    sha_short.short_description = 'SHA'

    def entry_count(self, obj):
        return len(obj.entries)
    entry_count.short_description = 'Entries'


@admin.register(Blob)
class BlobAdmin(admin.ModelAdmin):
    """Admin interface for Blob model."""
    list_display = ['sha_short', 'repository', 'size', 'storage_location', 'created_at']
    list_filter = ['created_at']
    search_fields = ['sha', 'repository__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at']

    def sha_short(self, obj):
        return obj.sha[:7]
    sha_short.short_description = 'SHA'

    def storage_location(self, obj):
        return 'Database' if obj.content else 'Filesystem'
    storage_location.short_description = 'Storage'
