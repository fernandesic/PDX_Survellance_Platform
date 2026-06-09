"""
Purge synthetic outbreak data so the dashboard shows only real-source rows.

The synthetic generator (`onehealth/oh_afro_generator.py`) seeded the
event tables (oh_alerts, oh_human_cases, oh_animal_events, oh_env_observations,
oh_disease_reports, oh_spillover_cache) with random demo data. Once real
ingestion is wired (sentinel → oh_alerts), that synthetic baggage just
confuses the dashboard — same score 76.2 across countries, fake outbreaks
in the alert feed, etc.

This command keeps anything traceable to a real source (alert_id like
'SIG-...', report_id like 'RPT-SIG-...') and drops the rest. Plus it
empties the spillover cache so the engine recomputes fresh on next refresh.

Idempotent. Safe to run multiple times.

Usage:
    python manage.py oh_purge_synthetic            # show counts, prompt for confirm
    python manage.py oh_purge_synthetic --yes      # actually delete
"""
from django.core.management.base import BaseCommand
from django.db import connection

from utils.tenant_tasks import tenant_context


COUNT_QUERIES = [
    ("oh_alerts (synthetic ALT-)",
     "SELECT count(*) FROM oh_alerts WHERE alert_id NOT LIKE 'SIG-%'"),
    ("oh_alerts (real SIG-)",
     "SELECT count(*) FROM oh_alerts WHERE alert_id LIKE 'SIG-%'"),
    ("oh_disease_reports (synthetic)",
     "SELECT count(*) FROM oh_disease_reports WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    ("oh_disease_reports (real)",
     "SELECT count(*) FROM oh_disease_reports WHERE report_id LIKE 'RPT-SIG-%'"),
    ("oh_human_cases (linked to synthetic)",
     "SELECT count(*) FROM oh_human_cases WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    ("oh_animal_events (linked to synthetic)",
     "SELECT count(*) FROM oh_animal_events WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    ("oh_env_observations (all rows are synthetic — no real ingest yet)",
     "SELECT count(*) FROM oh_env_observations"),
    ("oh_spillover_cache (all rows — recomputed on schedule)",
     "SELECT count(*) FROM oh_spillover_cache"),
]


DELETE_STATEMENTS = [
    # Children first (FK dependencies), then parents.
    ("oh_human_cases (synthetic)",
     "DELETE FROM oh_human_cases WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    ("oh_animal_events (synthetic)",
     "DELETE FROM oh_animal_events WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    ("oh_alerts (synthetic ALT-)",
     "DELETE FROM oh_alerts WHERE alert_id NOT LIKE 'SIG-%'"),
    ("oh_disease_reports (synthetic)",
     "DELETE FROM oh_disease_reports WHERE report_id NOT LIKE 'RPT-SIG-%'"),
    # Synthetic env observations — no real ingestion yet, so wipe entirely
    ("oh_env_observations (all)",
     "DELETE FROM oh_env_observations"),
    # Spillover cache will repopulate on next refresh
    ("oh_spillover_cache (all)",
     "DELETE FROM oh_spillover_cache"),
]


class Command(BaseCommand):
    help = "Delete synthetic outbreak rows so the dashboard shows only real data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes", action="store_true",
            help="Actually delete (otherwise just shows counts).",
        )

    def handle(self, *args, **opts):
        with tenant_context('0'):
            with connection.cursor() as cur:
                self.stdout.write(self.style.HTTP_INFO("\n=== Current row counts ==="))
                for label, sql in COUNT_QUERIES:
                    try:
                        cur.execute(sql)
                        n = cur.fetchone()[0]
                        self.stdout.write(f"  {label:50s} {n}")
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"  {label}: {e}"))

                if not opts["yes"]:
                    self.stdout.write(self.style.WARNING(
                        "\nDry run — no rows deleted. Re-run with --yes to actually purge."
                    ))
                    return

                self.stdout.write(self.style.HTTP_INFO("\n=== Deleting ==="))
                for label, sql in DELETE_STATEMENTS:
                    try:
                        cur.execute(sql)
                        self.stdout.write(f"  {label}: deleted {cur.rowcount} rows")
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"  {label}: {e}"))

                self.stdout.write(self.style.SUCCESS(
                    "\n✓ Synthetic data purged. The spillover_cache job will repopulate\n"
                    "  on its next 30-min run; until then the Early Warning panel\n"
                    "  will show only countries with real signal-derived events."
                ))
