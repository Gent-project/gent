from api.models import Repository, RepositoryMember, RepositoryMemberRole


def get_user_repo_role(user, repository):
    """Return 'owner', 'write', 'read', or None for the user's repo access."""
    if not user or not user.is_authenticated:
        return None
    if repository.owner_id == user.id:
        return 'owner'
    prefetched = getattr(repository, '_user_membership', None)
    if prefetched is not None:
        return prefetched[0].role if prefetched else None
    membership = RepositoryMember.objects.filter(
        repository=repository,
        user=user,
    ).first()
    if membership is None:
        return None
    return membership.role


def user_can_read_repo(user, repository):
    """Return True if the user can read the repository."""
    if not repository.is_private:
        return user is not None and user.is_authenticated
    return get_user_repo_role(user, repository) is not None


def user_can_write_repo(user, repository):
    """Return True if the user can push and modify repository content."""
    role = get_user_repo_role(user, repository)
    return role in ('owner', RepositoryMemberRole.WRITE)


def user_can_manage_repo(user, repository):
    """Return True if the user can manage repository settings and members."""
    return get_user_repo_role(user, repository) == 'owner'
