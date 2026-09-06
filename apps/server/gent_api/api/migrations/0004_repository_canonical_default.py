from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0003_tag_target_oid_tag_target_type')]

    operations = [
        migrations.AlterField(
            model_name='repository',
            name='object_format',
            field=models.CharField(
                choices=[('legacy', 'Legacy'), ('sha256', 'SHA-256')],
                default='sha256',
                max_length=10,
            ),
        ),
    ]
