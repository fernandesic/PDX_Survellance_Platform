from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sitrep_form', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitrepreport',
            name='weekly_highlights',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
