import re

from django.db import migrations, models


def _generate_username(email, taken):
    local_part = email.split('@')[0]
    base = re.sub(r'[^a-zA-Z0-9_-]', '', local_part).lower()
    if not base:
        base = 'user'
    elif base.isdigit():
        base = f'user-{base}'

    candidate = base
    suffix = 2
    while candidate in taken:
        candidate = f'{base}-{suffix}'
        suffix += 1
    taken.add(candidate)
    return candidate


def repair_username_column(apps, schema_editor):
    User = apps.get_model('api', 'User')
    table_name = User._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor,
                table_name,
            )
        }

    if 'username' in columns:
        return

    nullable_field = models.CharField(max_length=150, null=True)
    nullable_field.set_attributes_from_name('username')
    nullable_field.model = User
    schema_editor.add_field(User, nullable_field)

    taken = set()
    for user in User.objects.order_by('id').iterator():
        user.username = _generate_username(user.email, taken)
        user.save(update_fields=['username'])

    schema_editor.alter_field(
        User,
        nullable_field,
        User._meta.get_field('username'),
        strict=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(repair_username_column, migrations.RunPython.noop),
    ]
