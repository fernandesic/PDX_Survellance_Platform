from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('readiness', '0008_weekly_report_system'),
    ]

    operations = [
        # ── Remove old sub-fields ──
        migrations.RemoveField(model_name='weeklyreport', name='climate_risks'),
        migrations.RemoveField(model_name='weeklyreport', name='upcoming_ph_risks'),
        migrations.RemoveField(model_name='weeklyreport', name='espar_submission_tracker'),
        migrations.RemoveField(model_name='weeklyreport', name='ihr'),
        migrations.RemoveField(model_name='weeklyreport', name='pandemic_agreement'),
        migrations.RemoveField(model_name='weeklyreport', name='one_health'),
        migrations.RemoveField(model_name='weeklyreport', name='pandemic_fund'),
        migrations.RemoveField(model_name='weeklyreport', name='espar'),
        migrations.RemoveField(model_name='weeklyreport', name='jee'),
        migrations.RemoveField(model_name='weeklyreport', name='simex'),
        migrations.RemoveField(model_name='weeklyreport', name='ear_aar'),
        migrations.RemoveField(model_name='weeklyreport', name='cholera'),
        migrations.RemoveField(model_name='weeklyreport', name='meningitis'),
        migrations.RemoveField(model_name='weeklyreport', name='yellow_fever'),
        migrations.RemoveField(model_name='weeklyreport', name='ai_for_preparedness'),
        migrations.RemoveField(model_name='weeklyreport', name='reach_africa'),
        migrations.RemoveField(model_name='weeklyreport', name='probe_africa'),
        migrations.RemoveField(model_name='weeklyreport', name='cbrn'),
        migrations.RemoveField(model_name='weeklyreport', name='mass_gathering'),

        # ── Add new consolidated fields ──
        migrations.AddField(
            model_name='weeklyreport',
            name='key_figures',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='weeklyreport',
            name='health_security_governance',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='weeklyreport',
            name='health_security_financing',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='weeklyreport',
            name='ihrme',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='weeklyreport',
            name='diseases_under_elimination',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='weeklyreport',
            name='innovative_projects',
            field=models.TextField(blank=True, default=''),
        ),
    ]
