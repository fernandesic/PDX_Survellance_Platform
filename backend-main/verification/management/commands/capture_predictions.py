"""
Capture stage runner. Snapshots PDX predictions + counterfactual scenario
runs into immutable records.

Usage:
    python manage.py capture_predictions
    python manage.py capture_predictions --horizon 60
"""

from django.core.management.base import BaseCommand

from verification.services import capture


class Command(BaseCommand):
    help = 'CAPTURE: freeze PDX predictions and scenario runs into snapshots'

    def add_arguments(self, parser):
        parser.add_argument('--horizon', type=int, default=30,
                            help='Forecast horizon in days for the snapshot window.')
        parser.add_argument('--skip-scenarios', action='store_true',
                            help='Do not capture counterfactual scenario runs.')
        parser.add_argument('--skip-alerts', action='store_true',
                            help='Do not capture sentinel signals / HDIS alerts.')

    def handle(self, *args, **options):
        from django.db import transaction, connection
        with transaction.atomic():
            with connection.cursor() as c:
                c.execute("SET LOCAL app.current_tenant = '0'")
            return self._run(options)

    def _run(self, options):
        self.stdout.write(self.style.WARNING('CAPTURE: snapshotting PDX predictions...'))
        self.stdout.write('=' * 60)

        n_pred = capture.collect_predictions_module(horizon_days=options['horizon'])
        self.stdout.write(f'Predictions module snapshots created: {n_pred}')

        n_alerts = {'snapshots': 0, 'outcomes': 0}
        if not options['skip_alerts']:
            n_alerts = capture.collect_alerts_incidents(window_days=options['horizon'])
            self.stdout.write(
                f"Alerts & Incidents snapshots: {n_alerts['snapshots']}, "
                f"resolution outcomes: {n_alerts['outcomes']}"
            )
            official = capture.collect_official_outcomes()
            self.stdout.write(
                f"Official ground-truth outcomes — WHO DON: {official['who_don']}, "
                f"outbreak confirmed: {official['outbreak_confirmed']}, "
                f"cross-border: {official['cross_border_import']}"
            )

        n_scen = 0
        if not options['skip_scenarios']:
            n_scen = capture.collect_scenario_runs()
            self.stdout.write(f'Counterfactual scenario snapshots created: {n_scen} '
                              '(excluded from scoring)')

        ebola = capture.collect_pdx_outbreak_events(lookback_days=options['horizon'])
        self.stdout.write(
            f"Ebola PHEIC events ingested: {ebola['events']}, "
            f"outcomes derived: {ebola['outcomes']}"
        )

        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f"Done! {n_pred} forecast + {n_alerts['snapshots']} alert "
            f"+ {n_scen} counterfactual + {ebola['events']} ebola snapshots."
        ))
