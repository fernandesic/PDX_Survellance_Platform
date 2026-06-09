from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('readiness', '0009_simplify_weekly_report_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='weeklyreport',
            name='ipc',
            field=models.TextField(blank=True, default=''),
        ),
    ]
