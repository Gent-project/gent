from rest_framework import permissions

from api.services.repository_access import user_can_read_repo, user_can_write_repo


class IsRepositoryOwner(permissions.BasePermission):
    """Permission to only allow owners of a repository to modify it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return user_can_read_repo(request.user, obj)

        return user_can_write_repo(request.user, obj)


class CanWriteRepositoryByParams(permissions.BasePermission):
    """Gate write HTTP methods to authenticated users only.

    Does not resolve repository params or check collaborator roles; views call
    ``require_repo_write`` after ``get_repository_or_404`` for that.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated


IsRepositoryOwnerByParams = CanWriteRepositoryByParams
