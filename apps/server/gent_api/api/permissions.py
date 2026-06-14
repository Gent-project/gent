from rest_framework import permissions


class IsRepositoryOwner(permissions.BasePermission):
    """Permission to only allow owners of a repository to modify it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return not obj.is_private or obj.owner == request.user

        return obj.owner == request.user


class IsRepositoryOwnerByParams(permissions.BasePermission):
    """Permission check based on URL parameters (owner_id, repo_name)."""

    def has_permission(self, request, view):
        owner_id = view.kwargs.get('owner_id')

        if request.method not in permissions.SAFE_METHODS:
            return request.user.is_authenticated and request.user.id == int(owner_id)

        return True
