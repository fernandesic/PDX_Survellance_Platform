from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('readiness', '0010_weeklyreport_ipc'),
    ]

    operations = [
        migrations.AddField(
            model_name='weeklyreport',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
