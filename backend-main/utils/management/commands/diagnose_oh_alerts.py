"""
Diagnose why Active Alert Feed isn't showing new sentinel-derived alerts.

Checks each step in the pipeline:
  1. sentinel_signal table — are scrapers producing signals?
  2. AFRO-eligible signals — do they match oh_countries?
  3. oh_alerts table — are SIG- prefixed alerts present?
  4. Tier distribution — would they pass the frontend's min_tier=2 filter?
  5. Synthetic vs real ratio — what's actually in the table.

Usage: python manage.py diagnose_oh_alerts
"""
from django.core.management.base import BaseCommand
from django.db import connection

from utils.tenant_tasks import tenant_context


class Command(BaseCommand):
    help = "Diagnose the sentinel → oh_alerts pipeline."

    def handle(self, *args, **options):
        # sentinel_signal has RLS enabled. Set super-admin context so we see
        # signals across all tenants.
        with tenant_context('0'):
            self._run()

    def _run(self):
        with connection.cursor() as cur:
            self.stdout.write(self.style.HTTP_INFO("\n=== Step 1: sentinel_signal ingestion ==="))
            try:
                cur.execute("SELECT count(*) FROM sentinel_signal")
                total = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM sentinel_signal WHERE created_at > NOW() - INTERVAL '24 hours'")
                last_24h = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM sentinel_signal WHERE created_at > NOW() - INTERVAL '7 days'")
                last_7d = cur.fetchone()[0]
                cur.execute("SELECT max(created_at) FROM sentinel_signal")
                latest = cur.fetchone()[0]

                self.stdout.write(f"  total signals:       {total}")
                self.stdout.write(f"  last 24h:            {last_24h}")
                self.stdout.write(f"  last 7d:             {last_7d}")
                self.stdout.write(f"  latest signal:       {latest}")

                if total == 0:
                    self.stdout.write(self.style.ERROR(
                        "  ⚠ No signals at all. The sentinel scheduler is not ingesting."
                    ))
                    self.stdout.write(
                        "  Fix: ensure sentinel.scheduler.start_scheduler() is called on Django startup,\n"
                        "       OR run ingestion manually from sentinel/ingestion.py."
                    )
                elif last_24h == 0:
                    self.stdout.write(self.style.WARNING(
                        "  ⚠ No signals in last 24h. Scheduler may be stalled."
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  query failed: {e}"))

            self.stdout.write(self.style.HTTP_INFO("\n=== Step 2: AFRO-eligible signals ==="))
            try:
                cur.execute("""
                    SELECT count(*) FROM sentinel_signal s
                    JOIN oh_countries c ON c.iso3 = s.location_country_iso
                    WHERE s.disease_name IS NOT NULL
                      AND s.status NOT IN ('DISMISSED', 'RESOLVED', 'CLOSED')
                """)
                afro_eligible = cur.fetchone()[0]

                cur.execute("""
                    SELECT count(*) FROM sentinel_signal s
                    WHERE s.disease_name IS NOT NULL
                      AND s.location_country_iso IS NOT NULL
                      AND s.status NOT IN ('DISMISSED', 'RESOLVED', 'CLOSED')
                """)
                with_disease_iso = cur.fetchone()[0]

                self.stdout.write(f"  signals with disease+iso (any country): {with_disease_iso}")
                self.stdout.write(f"  signals matching AFRO countries:        {afro_eligible}")

                if with_disease_iso == 0:
                    self.stdout.write(self.style.WARNING(
                        "  ⚠ No signals have both disease_name + location_country_iso."
                    ))
                elif afro_eligible == 0:
                    self.stdout.write(self.style.WARNING(
                        "  ⚠ No signals match AFRO countries — sentinel may be ingesting global news."
                    ))
                    cur.execute("""
                        SELECT location_country_iso, count(*) FROM sentinel_signal
                        WHERE disease_name IS NOT NULL
                          AND location_country_iso IS NOT NULL
                        GROUP BY location_country_iso ORDER BY count(*) DESC LIMIT 10
                    """)
                    self.stdout.write("  top non-AFRO countries in signals:")
                    for iso, n in cur.fetchall():
                        self.stdout.write(f"    {iso}: {n}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  query failed: {e}"))

            self.stdout.write(self.style.HTTP_INFO("\n=== Step 3: oh_alerts SIG- entries ==="))
            try:
                cur.execute("SELECT count(*) FROM oh_alerts WHERE alert_id LIKE 'SIG-%'")
                sig_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM oh_alerts WHERE alert_id NOT LIKE 'SIG-%'")
                synth_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM oh_alerts")
                total_alerts = cur.fetchone()[0]

                self.stdout.write(f"  SIG- (real) alerts:    {sig_count}")
                self.stdout.write(f"  ALT- (synthetic):      {synth_count}")
                self.stdout.write(f"  total in oh_alerts:    {total_alerts}")

                if sig_count == 0:
                    self.stdout.write(self.style.ERROR(
                        "  ⚠ No SIG- alerts. Run: python manage.py import_sentinel_to_oh_alerts"
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  query failed: {e}"))

            self.stdout.write(self.style.HTTP_INFO("\n=== Step 4: tier distribution ==="))
            try:
                cur.execute("""
                    SELECT alert_tier, count(*) FROM oh_alerts
                    WHERE alert_id LIKE 'SIG-%'
                    GROUP BY alert_tier ORDER BY alert_tier
                """)
                rows = cur.fetchall()
                if rows:
                    for tier, n in rows:
                        marker = "  (filtered out — frontend uses min_tier=2)" if tier < 2 else ""
                        self.stdout.write(f"  tier {tier}: {n}{marker}")
                else:
                    self.stdout.write("  (none)")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  query failed: {e}"))

            self.stdout.write(self.style.HTTP_INFO("\n=== Step 5: what frontend will see (min_tier=2, limit=30) ==="))
            try:
                cur.execute("""
                    SELECT alert_id, disease_name, country_iso3, alert_tier, alert_date
                    FROM oh_alerts WHERE alert_tier >= 2
                    ORDER BY alert_date DESC, alert_tier DESC
                    LIMIT 10
                """)
                for row in cur.fetchall():
                    aid, dis, iso, tier, dt = row
                    prefix = "REAL " if aid.startswith("SIG-") else "SYNTH"
                    self.stdout.write(f"  [{prefix}] T{tier} {aid}  {dis} ({iso}) {dt}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  query failed: {e}"))

            self.stdout.write("")
