from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hdis', '0007_briefing_job_singleton_lock'),
    ]

    operations = [
        # Drop the global lock — one tenant's running briefing must not block
        # another tenant's. RLS hides cross-tenant rows from the view layer
        # but a global unique index sees everything at the DB level, which
        # caused phantom 409s for the second tenant.
        migrations.RemoveConstraint(
            model_name='briefinggenerationjob',
            name='only_one_running_briefing_job',
        ),
        migrations.AddConstraint(
            model_name='briefinggenerationjob',
            constraint=models.UniqueConstraint(
                fields=('tenant', 'lock_key'),
                name='only_one_running_briefing_job_per_tenant',
            ),
        ),
    ]
