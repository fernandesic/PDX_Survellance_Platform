"""
Initial schema for the verification app.

Hand-authored to match verification/models.py exactly. After installing the app
you can verify it is in sync with:  python manage.py makemigrations --check
(which should report "No changes detected").

Depends on the `account` app for the Tenant and User FKs.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('account', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PredictionSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_module', models.CharField(db_index=True, max_length=20, choices=[('predictions', 'Predictions / Composite Risk'), ('outbreak', 'Ebola Outbreak Workspace'), ('onehealth', 'One Health / Cross-Species Timeline'), ('alerts', 'Alerts & Incidents (alerts-v2)'), ('climate', 'Climate Module'), ('star', 'STAR Tracker'), ('sentinel', 'Sentinel Signals'), ('readiness', 'Readiness Assessment'), ('espar', 'IHR / e-SPAR'), ('ocv', 'OCV Dashboard'), ('pip', 'PIP Dashboard'), ('chw', 'CHW'), ('hdis', 'HDIS')])),
                ('prediction_class', models.CharField(db_index=True, max_length=30)),
                ('country_iso', models.CharField(db_index=True, max_length=3)),
                ('country_name', models.CharField(blank=True, default='', max_length=100)),
                ('disease_name', models.CharField(blank=True, db_index=True, default='', max_length=50)),
                ('province', models.CharField(blank=True, default='', max_length=200)),
                ('district', models.CharField(blank=True, default='', max_length=200)),
                ('predicted_label', models.CharField(blank=True, default='', max_length=50)),
                ('predicted_value', models.FloatField(blank=True, null=True)),
                ('predicted_probability', models.FloatField(blank=True, null=True)),
                ('predicted_interval', models.JSONField(blank=True, default=dict)),
                ('predicted_ranking', models.JSONField(blank=True, default=list)),
                ('horizon_days', models.IntegerField(blank=True, null=True)),
                ('window_start', models.DateTimeField(db_index=True)),
                ('window_end', models.DateTimeField(db_index=True)),
                ('model_version', models.CharField(blank=True, default='', max_length=100)),
                ('computed_at', models.DateTimeField(blank=True, null=True)),
                ('payload_complete', models.BooleanField(default=True)),
                ('is_counterfactual', models.BooleanField(db_index=True, default=False)),
                ('scenario_run_id', models.IntegerField(blank=True, null=True)),
                ('raw_payload', models.JSONField(default=dict)),
                ('payload_fingerprint', models.CharField(db_index=True, max_length=64)),
                ('source_endpoint', models.CharField(blank=True, default='', max_length=255)),
                ('captured_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prediction_snapshots', to='account.tenant')),
            ],
            options={'ordering': ['-captured_at']},
        ),
        migrations.CreateModel(
            name='OutcomeEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('outcome_type', models.CharField(db_index=True, max_length=30, choices=[('outbreak_confirmed', 'Outbreak confirmed'), ('who_don', 'WHO Disease Outbreak News declaration'), ('pheic_declared', 'PHEIC declaration'), ('case_observation', 'Observed case/death count'), ('cross_border_import', 'Cross-border importation event'), ('hcw_infection', 'HCW infection confirmed'), ('unsafe_burial', 'Unsafe burial confirmed'), ('dhis2_gap', 'Confirmed DHIS2 reporting gap'), ('intervention_action', 'Intervention recorded (HDIS/Decision Log)'), ('first_human_case', 'First human case (spillover realised)'), ('live_feed_signal', 'Verified Live-Feed signal')])),
                ('source_feed', models.CharField(db_index=True, max_length=30, choices=[('live_feed', 'PDX Live Feed / alerts-v2'), ('outbreak_epicurve', 'Outbreak Workspace epi-curve'), ('outbreak_events', 'Outbreak Workspace event stream'), ('hdis', 'HDIS alerts & briefings'), ('who_don', 'WHO DON (external)'), ('decision_log', 'Outbreak Ops decision log'), ('dhis2', 'AFRO DHIS2 submission log'), ('manual', 'Manual / epidemiologist entry')])),
                ('country_iso', models.CharField(db_index=True, max_length=3)),
                ('country_name', models.CharField(blank=True, default='', max_length=100)),
                ('disease_name', models.CharField(blank=True, db_index=True, default='', max_length=50)),
                ('province', models.CharField(blank=True, default='', max_length=200)),
                ('district', models.CharField(blank=True, default='', max_length=200)),
                ('observed_label', models.CharField(blank=True, default='', max_length=50)),
                ('observed_value', models.FloatField(blank=True, null=True)),
                ('observed_cases', models.IntegerField(blank=True, null=True)),
                ('observed_deaths', models.IntegerField(blank=True, null=True)),
                ('occurred_at', models.DateTimeField(db_index=True)),
                ('iso_week', models.CharField(blank=True, default='', max_length=8)),
                ('evidence_url', models.URLField(blank=True, default='')),
                ('evidence_snapshot_url', models.URLField(blank=True, default='')),
                ('raw_payload', models.JSONField(default=dict)),
                ('payload_fingerprint', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('collected_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='outcome_events', to='account.tenant')),
            ],
            options={'ordering': ['-occurred_at']},
        ),
        migrations.CreateModel(
            name='MatchVerdict',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('verdict', models.CharField(db_index=True, default='PENDING', max_length=12, choices=[('PENDING', 'Pending — window still open'), ('HIT', 'Confirmed Hit'), ('PARTIAL', 'Partial Hit'), ('MISS', 'Miss'), ('FALSE_ALARM', 'False Alarm'), ('EXCLUDED', 'Excluded from scoring')])),
                ('disease_match', models.BooleanField(blank=True, null=True)),
                ('geography_match', models.BooleanField(blank=True, null=True)),
                ('time_match', models.BooleanField(blank=True, null=True)),
                ('lead_time_days', models.FloatField(blank=True, null=True)),
                ('abs_error', models.FloatField(blank=True, null=True)),
                ('brier_component', models.FloatField(blank=True, null=True)),
                ('wis_component', models.FloatField(blank=True, null=True)),
                ('evidence_note', models.TextField(blank=True, default='')),
                ('match_detail', models.JSONField(blank=True, default=dict)),
                ('matched_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('matched_outcomes', models.ManyToManyField(blank=True, related_name='verdicts', to='verification.outcomeevent')),
                ('snapshot', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='verdict', to='verification.predictionsnapshot')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='match_verdicts', to='account.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ScoreCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('granularity', models.CharField(db_index=True, max_length=20, choices=[('global', 'PDX-wide'), ('module', 'Per module'), ('country', 'Per country'), ('disease', 'Per disease'), ('module_country', 'Module × country'), ('module_disease', 'Module × disease')])),
                ('source_module', models.CharField(blank=True, db_index=True, default='', max_length=20)),
                ('country_iso', models.CharField(blank=True, db_index=True, default='', max_length=3)),
                ('disease_name', models.CharField(blank=True, db_index=True, default='', max_length=50)),
                ('period_start', models.DateTimeField()),
                ('period_end', models.DateTimeField()),
                ('n_total', models.IntegerField(default=0)),
                ('n_hit', models.IntegerField(default=0)),
                ('n_partial', models.IntegerField(default=0)),
                ('n_miss', models.IntegerField(default=0)),
                ('n_false_alarm', models.IntegerField(default=0)),
                ('n_pending', models.IntegerField(default=0)),
                ('n_excluded', models.IntegerField(default=0)),
                ('hit_rate', models.FloatField(blank=True, null=True)),
                ('precision', models.FloatField(blank=True, null=True)),
                ('recall', models.FloatField(blank=True, null=True)),
                ('f1_score', models.FloatField(blank=True, null=True)),
                ('false_alarm_rate', models.FloatField(blank=True, null=True)),
                ('brier_score', models.FloatField(blank=True, null=True)),
                ('wis_mean', models.FloatField(blank=True, null=True)),
                ('cohen_kappa', models.FloatField(blank=True, null=True)),
                ('mean_lead_time_days', models.FloatField(blank=True, null=True)),
                ('reliability', models.JSONField(blank=True, default=list)),
                ('veracity_contribution', models.FloatField(blank=True, null=True)),
                ('computed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='score_cards', to='account.tenant')),
            ],
            options={'ordering': ['-computed_at']},
        ),
        migrations.CreateModel(
            name='VeracityIndex',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.CharField(db_index=True, max_length=12, choices=[('module', 'Module'), ('platform', 'PDX platform-wide')])),
                ('source_module', models.CharField(blank=True, default='', max_length=20)),
                ('index_value', models.FloatField()),
                ('n_predictions_scored', models.IntegerField(default=0)),
                ('components', models.JSONField(blank=True, default=dict)),
                ('trend_delta', models.FloatField(blank=True, null=True)),
                ('computed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='veracity_indices', to='account.tenant')),
            ],
            options={'ordering': ['-computed_at'], 'verbose_name_plural': 'Veracity indices'},
        ),
        migrations.CreateModel(
            name='ReviewTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_module', models.CharField(db_index=True, max_length=20)),
                ('reason', models.CharField(db_index=True, max_length=20, choices=[('MISS', 'Significant miss'), ('FALSE_ALARM', 'False alarm'), ('CALIBRATION_DRIFT', 'Systematic calibration drift'), ('DATA_GAP', 'Ground-truth data gap')])),
                ('status', models.CharField(db_index=True, default='OPEN', max_length=14, choices=[('OPEN', 'Open'), ('ACKNOWLEDGED', 'Acknowledged'), ('RESOLVED', 'Resolved'), ('WONTFIX', "Won't fix")])),
                ('title', models.CharField(max_length=255)),
                ('detail', models.TextField(blank=True, default='')),
                ('country_iso', models.CharField(blank=True, db_index=True, default='', max_length=3)),
                ('disease_name', models.CharField(blank=True, default='', max_length=50)),
                ('resolution_note', models.TextField(blank=True, default='')),
                ('opened_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('closed_at', models.DateTimeField(blank=True, null=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verification_tickets', to=settings.AUTH_USER_MODEL)),
                ('verdict', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='verification.matchverdict')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='review_tickets', to='account.tenant')),
            ],
            options={'ordering': ['-opened_at']},
        ),
        migrations.CreateModel(
            name='CalibrationRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_module', models.CharField(db_index=True, max_length=20)),
                ('disease_name', models.CharField(blank=True, db_index=True, default='', max_length=50)),
                ('country_iso', models.CharField(blank=True, db_index=True, default='', max_length=3)),
                ('stated_confidence_mean', models.FloatField(blank=True, null=True)),
                ('observed_frequency', models.FloatField(blank=True, null=True)),
                ('calibration_error', models.FloatField(blank=True, null=True)),
                ('suggested_multiplier', models.FloatField(default=1.0)),
                ('suggested_offset', models.FloatField(default=0.0)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('n_samples', models.IntegerField(default=0)),
                ('reliability', models.JSONField(blank=True, default=list)),
                ('computed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='calibration_records', to='account.tenant')),
            ],
            options={'ordering': ['-computed_at']},
        ),
        migrations.CreateModel(
            name='EbolaEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('outbreak_id', models.IntegerField(db_index=True, default=1)),
                ('event_uid', models.CharField(db_index=True, max_length=120, unique=True)),
                ('event_kind', models.CharField(db_index=True, max_length=20, choices=[('sentinel', 'Sentinel signal'), ('spillover', 'Spillover risk'), ('silence', 'District unusually quiet'), ('hcw', 'HCW infection'), ('burial', 'Unsafe burial'), ('idsr', 'IDSR/DHIS2'), ('animal', 'Animal surveillance'), ('mobility', 'Mobility'), ('other', 'Other')])),
                ('country_iso', models.CharField(blank=True, db_index=True, default='', max_length=3)),
                ('province', models.CharField(blank=True, default='', max_length=200)),
                ('district', models.CharField(blank=True, default='', max_length=200)),
                ('severity', models.CharField(blank=True, default='', max_length=20)),
                ('summary', models.TextField(blank=True, default='')),
                ('citations', models.JSONField(blank=True, default=list)),
                ('raw_event', models.JSONField(default=dict)),
                ('occurred_at', models.DateTimeField(db_index=True)),
                ('received_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ebola_events', to='account.tenant')),
            ],
            options={'ordering': ['-occurred_at']},
        ),
        migrations.CreateModel(
            name='SourceAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('adaptor', models.CharField(db_index=True, max_length=30, choices=[('sentinel_signal', 'sentinel_signal'), ('spillover_risk', 'spillover_risk'), ('silence', 'silence'), ('hcw_infection', 'hcw_infection'), ('idsr_dhis2', 'idsr_dhis2'), ('animal_surveillance', 'animal_surveillance'), ('unsafe_burial', 'unsafe_burial'), ('wbepi_forecast', 'wbepi_forecast'), ('mobility', 'mobility'), ('deforestation', 'deforestation'), ('climate', 'climate')])),
                ('outbreak_id', models.IntegerField(db_index=True, default=1)),
                ('status', models.CharField(db_index=True, max_length=12, choices=[('LIVE', 'Live'), ('STALE', 'Stale (> 2× cadence)'), ('KNOWN_GAP', 'Known coverage gap'), ('MISSING', 'Missing / not configured')])),
                ('expected_cadence_hours', models.FloatField(blank=True, null=True)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('staleness_hours', models.FloatField(blank=True, null=True)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('checked_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_audits', to='account.tenant')),
            ],
            options={'ordering': ['-checked_at']},
        ),
        # ── Indexes ──────────────────────────────────────────────
        migrations.AddIndex(
            model_name='predictionsnapshot',
            index=models.Index(fields=['source_module', 'prediction_class'], name='verif_snap_mod_cls_idx'),
        ),
        migrations.AddIndex(
            model_name='predictionsnapshot',
            index=models.Index(fields=['country_iso', 'disease_name'], name='verif_snap_iso_dis_idx'),
        ),
        migrations.AddIndex(
            model_name='predictionsnapshot',
            index=models.Index(fields=['window_end', 'is_counterfactual'], name='verif_snap_win_cf_idx'),
        ),
        migrations.AddIndex(
            model_name='predictionsnapshot',
            index=models.Index(fields=['payload_fingerprint'], name='verif_snap_fp_idx'),
        ),
        migrations.AddIndex(
            model_name='outcomeevent',
            index=models.Index(fields=['outcome_type', 'country_iso'], name='verif_out_type_iso_idx'),
        ),
        migrations.AddIndex(
            model_name='outcomeevent',
            index=models.Index(fields=['country_iso', 'disease_name', 'occurred_at'], name='verif_out_iso_dis_occ_idx'),
        ),
        migrations.AddIndex(
            model_name='outcomeevent',
            index=models.Index(fields=['occurred_at'], name='verif_out_occ_idx'),
        ),
        migrations.AddIndex(
            model_name='matchverdict',
            index=models.Index(fields=['verdict', '-created_at'], name='verif_verd_v_created_idx'),
        ),
        migrations.AddIndex(
            model_name='scorecard',
            index=models.Index(fields=['granularity', 'source_module'], name='verif_sc_gran_mod_idx'),
        ),
        migrations.AddIndex(
            model_name='scorecard',
            index=models.Index(fields=['country_iso', 'disease_name'], name='verif_sc_iso_dis_idx'),
        ),
        migrations.AddIndex(
            model_name='scorecard',
            index=models.Index(fields=['-computed_at'], name='verif_sc_computed_idx'),
        ),
        migrations.AddIndex(
            model_name='veracityindex',
            index=models.Index(fields=['level', 'source_module', '-computed_at'], name='verif_vi_lvl_mod_idx'),
        ),
        migrations.AddIndex(
            model_name='reviewticket',
            index=models.Index(fields=['status', 'source_module'], name='verif_tk_status_mod_idx'),
        ),
        migrations.AddIndex(
            model_name='reviewticket',
            index=models.Index(fields=['reason', '-opened_at'], name='verif_tk_reason_op_idx'),
        ),
        migrations.AddIndex(
            model_name='calibrationrecord',
            index=models.Index(fields=['source_module', 'disease_name', 'is_active'], name='verif_cal_mod_dis_act_idx'),
        ),
        migrations.AddIndex(
            model_name='ebolaevent',
            index=models.Index(fields=['outbreak_id', 'event_kind', '-occurred_at'], name='verif_eb_ob_kind_occ_idx'),
        ),
        migrations.AddIndex(
            model_name='ebolaevent',
            index=models.Index(fields=['country_iso', '-occurred_at'], name='verif_eb_iso_occ_idx'),
        ),
        migrations.AddIndex(
            model_name='sourceaudit',
            index=models.Index(fields=['adaptor', '-checked_at'], name='verif_sa_adaptor_chk_idx'),
        ),
    ]
