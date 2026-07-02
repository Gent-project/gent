import re

from django.db import migrations, models

# Frozen snapshot of api.username_utils generation rules (GEN-83).
# Intentionally not imported from runtime code — data migrations must stay
# self-contained so fresh DB replays match original backfill semantics.


def _sanitize_local_part(email):
    local_part = email.split('@')[0]
    return re.sub(r'[^a-zA-Z0-9_-]', '', local_part).lower()


def _ensure_non_numeric_base(base):
    if not base:
        return 'user'
    if base.isdigit():
        return f'user-{base}'
    return base


def _generate_username_for_user(email, taken):
    base = _ensure_non_numeric_base(_sanitize_local_part(email))
    candidate = base
    suffix = 2
    while candidate in taken:
        candidate = f'{base}-{suffix}'
        suffix += 1
    taken.add(candidate)
    return candidate


def backfill_usernames(apps, schema_editor):
    User = apps.get_model('api', 'User')
    taken = set(
        User.objects.exclude(username__isnull=True)
        .exclude(username='')
        .values_list('username', flat=True)
    )
    for user in User.objects.filter(username__isnull=True).order_by('id'):
        user.username = _generate_username_for_user(user.email, taken)
        user.save(update_fields=['username'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_repositorymember'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='username',
            field=models.CharField(max_length=150, null=True, unique=True),
        ),
        migrations.RunPython(backfill_usernames, noop_reverse),
        migrations.AlterField(
            model_name='user',
            name='username',
            field=models.CharField(max_length=150, unique=True),
        ),
    ]
