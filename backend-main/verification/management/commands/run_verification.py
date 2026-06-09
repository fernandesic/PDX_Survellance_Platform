"""
Run the MATCH → SCORE → FEEDBACK pipeline over all captured snapshots whose
windows have closed.

Usage:
    python manage.py run_verification
    python manage.py run_verification --match-only
    python manage.py run_verification --since 2026-01-01
"""

from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand

from verification.services import matching, scoring, feedback


class Command(BaseCommand):
    help = 'Run MATCH, SCORE, and FEEDBACK stages of the verification pipeline'

    def add_arguments(self, parser):
        parser.add_argument('--match-only', action='store_true')
        parser.add_argument('--score-only', action='store_true')
        parser.add_argument('--feedback-only', action='store_true')
        parser.add_argument('--stale-grace-days', type=int, default=7,
                            help='Force a verdict on snapshots still PENDING this many '
                                 'days after their window closed (0 = immediately).')
        parser.add_argument('--since', type=str, default=None,
                            help='ISO date; restrict scoring period start.')

    def handle(self, *args, **options):
        from django.db import transaction, connection
        with transaction.atomic():
            with connection.cursor() as c:
                c.execute("SET LOCAL app.current_tenant = '0'")
            self._run(options)

    def _run(self, options):
        since = None
        if options['since']:
            since = datetime.fromisoformat(options['since']).replace(tzinfo=dt_timezone.utc)

        do_all = not any([options['match_only'], options['score_only'], options['feedback_only']])

        if do_all or options['match_only']:
            self.stdout.write(self.style.WARNING('MATCH: judging due predictions...'))
            summary = matching.match_due_snapshots()
            self.stdout.write(self.style.SUCCESS(f'  {summary}'))
            stale = matching.resolve_stale_pending(grace_days=options['stale_grace_days'])
            self.stdout.write(self.style.SUCCESS(f'  stale resolved: {stale}'))

        if do_all or options['score_only']:
            self.stdout.write(self.style.WARNING('SCORE: generating scorecards...'))
            n_cards = scoring.generate_scorecards(period_start=since)
            self.stdout.write(self.style.SUCCESS(f'  {n_cards} scorecards written'))
            self.stdout.write(self.style.WARNING('SCORE: rolling up Veracity Index...'))
            indices = scoring.compute_veracity_indices(period_start=since)
            for vi in indices:
                scope = vi.source_module if vi.level == 'module' else 'PDX-WIDE'
                self.stdout.write(f'  {scope}: {vi.index_value}')

        if do_all or options['feedback_only']:
            self.stdout.write(self.style.WARNING('FEEDBACK: opening review tickets...'))
            tickets = feedback.open_review_tickets()
            self.stdout.write(self.style.SUCCESS(f'  {len(tickets)} tickets opened'))
            self.stdout.write(self.style.WARNING('FEEDBACK: computing calibration...'))
            recs = feedback.compute_calibration()
            self.stdout.write(self.style.SUCCESS(f'  {len(recs)} calibration records written'))

        self.stdout.write(self.style.SUCCESS('Pipeline complete.'))
