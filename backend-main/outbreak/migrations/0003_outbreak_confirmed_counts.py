# Manually written: adds Ministry/WHO-sourced confirmed counts to Outbreak.
# All four columns are nullable / blank-default so the migration is additive
# and safe on a populated DB.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('outbreak', '0002_pathogen_monitor_widgets_outbreaknotification_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='outbreak',
            name='confirmed_cases',
            field=models.PositiveIntegerField(
                null=True, blank=True,
                help_text='Authoritative confirmed + probable case count from Ministry/WHO sitrep.',
            ),
        ),
        migrations.AddField(
            model_name='outbreak',
            name='confirmed_deaths',
            field=models.PositiveIntegerField(
                null=True, blank=True,
                help_text='Authoritative death count from Ministry/WHO sitrep.',
            ),
        ),
        migrations.AddField(
            model_name='outbreak',
            name='confirmed_as_of',
            field=models.DateTimeField(
                null=True, blank=True,
                help_text='Date of the sitrep these numbers come from.',
            ),
        ),
        migrations.AddField(
            model_name='outbreak',
            name='confirmed_source',
            field=models.CharField(
                max_length=300, default='',
                help_text='Citation for the confirmed numbers, e.g. "WHO DON 2026-05-15" or sitrep URL.',
            ),
        ),
    ]
