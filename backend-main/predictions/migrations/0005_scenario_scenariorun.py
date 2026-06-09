# Generated for the wbepi counterfactual scenario engine (Sprint 2A).
# Adds Scenario and ScenarioRun models with tenant FK to account.Tenant.
# RLS policies are enabled separately in 0006_enable_rls_scenarios.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0014_add_tenant_model_and_user_fk'),
        ('predictions', '0004_enable_rls_all'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Scenario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('pathogen', models.CharField(
                    choices=[
                        ('cholera', 'Cholera'),
                        ('mpox', 'Mpox'),
                        ('measles', 'Measles'),
                        ('meningitis', 'Meningitis'),
                        ('ebola', 'Ebola'),
                        ('marburg', 'Marburg'),
                        ('lassa_fever', 'Lassa Fever'),
                        ('rift_valley_fever', 'Rift Valley Fever'),
                        ('yellow_fever', 'Yellow Fever'),
                        ('other', 'Other / Custom'),
                    ],
                    db_index=True,
                    max_length=40,
                )),
                ('country_iso', models.CharField(blank=True, db_index=True, default='', max_length=3)),
                ('parameters', models.JSONField(
                    default=dict,
                    help_text='Inputs to run_seirdv: beta, sigma, gamma, mu, ini_S, ini_I, time, n_sims, ...',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='scenarios',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('tenant', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='wbepi_scenarios',
                    to='account.tenant',
                    help_text='Country tenant for RLS scoping.',
                )),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='scenario',
            index=models.Index(fields=['pathogen', 'country_iso'], name='predictions_pathoge_6b0fc0_idx'),
        ),
        migrations.CreateModel(
            name='ScenarioRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('PENDING', 'Pending'),
                        ('RUNNING', 'Running'),
                        ('SUCCESS', 'Success'),
                        ('FAILED', 'Failed'),
                    ],
                    db_index=True,
                    default='PENDING',
                    max_length=12,
                )),
                ('seed', models.BigIntegerField(blank=True, null=True)),
                ('parameters_snapshot', models.JSONField(
                    default=dict,
                    help_text='Frozen copy of the run_seirdv kwargs used for this run.',
                )),
                ('n_sims', models.IntegerField(default=1)),
                ('time_steps', models.IntegerField(default=1)),
                ('summary_stats', models.JSONField(
                    blank=True, default=dict,
                    help_text='Aggregated stats: per-pop median final attack rate, peak time, total deaths CI, ...',
                )),
                ('output_blob', models.JSONField(
                    blank=True, null=True,
                    help_text='Long-format output rows (sim, step, S[1]..status[n]). Null if offloaded.',
                )),
                ('error_message', models.TextField(blank=True, default='')),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('scenario', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='runs',
                    to='predictions.scenario',
                    help_text='Source scenario; null for ad-hoc runs not tied to a saved scenario.',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='scenario_runs',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('tenant', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='wbepi_scenario_runs',
                    to='account.tenant',
                    help_text='Country tenant for RLS scoping.',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='scenariorun',
            index=models.Index(fields=['scenario', '-created_at'], name='predictions_scenari_801597_idx'),
        ),
        migrations.AddIndex(
            model_name='scenariorun',
            index=models.Index(fields=['status', '-created_at'], name='predictions_status_10c61d_idx'),
        ),
    ]
