from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hdis', '0006_enable_rls_all'),
    ]

    operations = [
        # 1. Add the column with NO DDL default — existing rows get NULL.
        # Multiple NULLs are permitted by the unique index, so the constraint
        # below applies cleanly. RLS-hidden rows are also NULL (DDL adds the
        # column for every row regardless of RLS), so no duplicates.
        migrations.AddField(
            model_name='briefinggenerationjob',
            name='lock_key',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        # 2. State-only change: register the Python-level default ('running')
        # so the ORM sets it on new inserts. This does NOT touch existing rows
        # (ALTER COLUMN SET DEFAULT only affects future inserts).
        migrations.AlterField(
            model_name='briefinggenerationjob',
            name='lock_key',
            field=models.CharField(blank=True, default='running', max_length=20, null=True),
        ),
        # 3. Singleton-lock guarantee at the DB layer.
        migrations.AddConstraint(
            model_name='briefinggenerationjob',
            constraint=models.UniqueConstraint(
                fields=('lock_key',),
                name='only_one_running_briefing_job',
            ),
        ),
    ]
