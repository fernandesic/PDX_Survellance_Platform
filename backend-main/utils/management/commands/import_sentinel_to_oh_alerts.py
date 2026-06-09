"""
Convert real-world sentinel signals into One Health alerts.

Reads from `sentinel_signal` (populated by sentinel/ingestion.py from real
external sources — ProMED, WHO Disease Outbreak News, ReliefWeb, GDELT,
HealthMap) and writes derived rows into `oh_alerts` (with parent rows in
`oh_disease_reports`) so the One Health dashboard shows real outbreak
events instead of the synthetic data produced by `oh_afro_generator.py`.

Idempotent: uses deterministic alert_id = 'SIG-<signal_id>' with
ON CONFLICT DO UPDATE so re-running is safe.

Usage:
    python manage.py import_sentinel_to_oh_alerts
    python manage.py import_sentinel_to_oh_alerts --since-hours 24
    python manage.py import_sentinel_to_oh_alerts --all
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

from utils.tenant_tasks import tenant_context


# ─── Tier mapping ────────────────────────────────────────────────────────

def _signal_to_tier(severity, priority, confidence):
    """Map sentinel signal fields to oh_alerts.alert_tier (1-4).

    Prefer AI severity (more recent, LLM-informed); fall back to priority + confidence.
    """
    if severity:
        s = severity.lower()
        if s == "critical":
            return 4
        if s == "high":
            return 3
        if s == "moderate":
            return 2
        if s == "low":
            return 1

    # Fallback — priority is P1..P4
    p = (priority or "").upper()
    c = confidence or 50
    if p == "P1" and c >= 80:
        return 4
    if p == "P1":
        return 3
    if p == "P2":
        return 2
    return 1


_STATUS_MAP = {
    # Sentinel SignalStatus → oh_alerts.status
    "NEW": "open",
    "TRIAGED": "open",
    "VERIFIED": "investigating",
    "INVESTIGATING": "investigating",
    "DISMISSED": "closed",
    "RESOLVED": "closed",
    "CLOSED": "closed",
}


def _signal_to_status(s):
    return _STATUS_MAP.get((s or "NEW").upper(), "open")


# ─── SQL ────────────────────────────────────────────────────────────────

# Pull AFRO-country signals (those whose iso3 exists in oh_countries) that
# have a disease_name set and aren't dismissed.
SELECT_SIGNALS = """
SELECT s.id, s.disease_name, s.location_country, s.location_country_iso,
       s.location_admin1, s.location_admin2,
       s.location_lat, s.location_lng,
       s.priority, s.confidence_score, s.status,
       s.reported_cases, s.reported_deaths,
       s.ai_severity, s.cross_border_risk, s.source_tier,
       s.source_timestamp, s.created_at,
       s.source_name, s.source_url
FROM sentinel_signal s
JOIN oh_countries c ON c.iso3 = s.location_country_iso
WHERE s.disease_name IS NOT NULL
  AND s.location_country_iso IS NOT NULL
  AND s.status NOT IN ('DISMISSED', 'RESOLVED', 'CLOSED')
  {since_clause}
ORDER BY s.created_at DESC
LIMIT %s
"""

# Lookup pathogen flags so the new alert carries IHR / WOAH metadata.
# Try exact match first, then fuzzy substring match (handles e.g.
# "Hantavirus Pulmonary Syndrome" in sentinel vs "Hantavirus" in profiles,
# "Lassa Fever" vs "Lassa fever" etc.).
LOOKUP_PATHOGEN = """
SELECT ihr_notifiable, woah_listed, domain, natural_host
FROM oh_pathogen_profiles
WHERE LOWER(disease) = LOWER(%s)
LIMIT 1
"""

LOOKUP_PATHOGEN_FUZZY = """
SELECT ihr_notifiable, woah_listed, domain, natural_host
FROM oh_pathogen_profiles
WHERE LOWER(disease) LIKE %s
   OR LOWER(%s) LIKE '%%' || LOWER(disease) || '%%'
ORDER BY length(disease) ASC
LIMIT 1
"""

# Parent disease_report row — referenced by oh_alerts.report_id FK.
# Includes has_animal_event / has_human_case flags so the spillover engine
# can filter on them.
UPSERT_REPORT = """
INSERT INTO oh_disease_reports (
    report_id, country_iso3, district, disease_name, disease_domain,
    report_date, case_count, alert_tier, report_source, data_completeness_pct,
    has_animal_event, has_human_case, ihr_notifiable, woah_listed
) VALUES (
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s
)
ON CONFLICT (report_id) DO UPDATE SET
    country_iso3    = EXCLUDED.country_iso3,
    district        = EXCLUDED.district,
    disease_name    = EXCLUDED.disease_name,
    disease_domain  = EXCLUDED.disease_domain,
    report_date     = EXCLUDED.report_date,
    case_count      = EXCLUDED.case_count,
    alert_tier      = EXCLUDED.alert_tier,
    report_source   = EXCLUDED.report_source,
    has_animal_event = EXCLUDED.has_animal_event,
    has_human_case   = EXCLUDED.has_human_case,
    ihr_notifiable   = EXCLUDED.ihr_notifiable,
    woah_listed      = EXCLUDED.woah_listed
"""

UPSERT_ALERT = """
INSERT INTO oh_alerts (
    alert_id, report_id, country_iso3, district, disease_name,
    alert_tier, alert_date, status,
    ihr_notifiable, woah_listed,
    response_hours, gps_lat, gps_lon, auto_escalated
) VALUES (
    %s, %s, %s, %s, %s,
    %s, %s, %s,
    %s, %s,
    %s, %s, %s, TRUE
)
ON CONFLICT (alert_id) DO UPDATE SET
    country_iso3   = EXCLUDED.country_iso3,
    district       = EXCLUDED.district,
    disease_name   = EXCLUDED.disease_name,
    alert_tier     = EXCLUDED.alert_tier,
    status         = EXCLUDED.status,
    ihr_notifiable = EXCLUDED.ihr_notifiable,
    woah_listed    = EXCLUDED.woah_listed,
    gps_lat        = EXCLUDED.gps_lat,
    gps_lon        = EXCLUDED.gps_lon
"""

# Optional: insert a human-cases child row so the AlertDetailDrawer's
# burden numbers reflect real signal data.
UPSERT_HUMAN_CASES = """
DELETE FROM oh_human_cases WHERE report_id = %s;
INSERT INTO oh_human_cases (
    report_id, onset_date, case_count, lab_confirmed
) VALUES (
    %s, %s, %s, FALSE
)
"""

UPSERT_ANIMAL_EVENTS = """
DELETE FROM oh_animal_events WHERE report_id = %s;
INSERT INTO oh_animal_events (
    report_id, species, animals_dead, mortality_pct, onset_date, human_exposure, humans_exposed, woah_notified, lab_confirmed
) VALUES (
    %s, %s, %s, 50.0, %s, %s, %s, %s, FALSE
)
"""


class Command(BaseCommand):
    help = "Import real sentinel signals into oh_alerts so the dashboard shows live outbreak data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--since-hours", type=int, default=72,
            help="Only import signals from the last N hours (default 72). Use --all to override.",
        )
        parser.add_argument(
            "--all", action="store_true",
            help="Ignore time window and import every eligible signal.",
        )
        parser.add_argument(
            "--limit", type=int, default=200,
            help="Maximum number of signals to import per run (default 200).",
        )
        parser.add_argument(
            "--verbose-rows", action="store_true",
            help="Print each imported row.",
        )

    def handle(self, *args, **opts):
        # sentinel_signal has RLS enabled. Without super-admin tenant context
        # SELECTs return 0 rows even though signals exist.
        with tenant_context('0'):
            self._run(opts)

    def _run(self, opts):
        since_hours = opts["since_hours"]
        do_all = opts["all"]
        limit = opts["limit"]
        verbose_rows = opts["verbose_rows"]

        since_clause = "" if do_all else \
            f"AND s.created_at > NOW() - INTERVAL '{int(since_hours)} hours'"
        select_sql = SELECT_SIGNALS.format(since_clause=since_clause)

        imported = 0
        skipped_no_pathogen = 0

        with connection.cursor() as cur:
            cur.execute(select_sql, [limit])
            rows = cur.fetchall()

            if not rows:
                self.stdout.write(self.style.WARNING(
                    "No eligible sentinel signals found "
                    f"(since-hours={since_hours}, limit={limit})."
                ))
                return

            for row in rows:
                (sid, disease, country_name, iso3,
                 admin1, admin2, lat, lng,
                 priority, confidence, status,
                 cases, deaths, ai_severity, cross_border, source_tier,
                 source_ts, created_at,
                 source_name, source_url) = row

                tier = _signal_to_tier(ai_severity, priority, confidence)
                alert_status = _signal_to_status(status)
                alert_id = f"SIG-{sid}"
                report_id = f"RPT-SIG-{sid}"
                # alert_date is DATE — drop time component
                alert_date = (source_ts or created_at).date()
                district = admin2 or admin1 or None

                # Pathogen IHR/WOAH lookup — exact match first, then fuzzy
                cur.execute(LOOKUP_PATHOGEN, [disease])
                p = cur.fetchone()
                if not p:
                    cur.execute(LOOKUP_PATHOGEN_FUZZY, [
                        f"%{disease.lower()}%", disease,
                    ])
                    p = cur.fetchone()
                if p:
                    ihr_notifiable, woah_listed = bool(p[0]), bool(p[1])
                    pathogen_domain = p[2] or 'human'
                    natural_host = p[3] or 'unknown'
                else:
                    ihr_notifiable, woah_listed = False, False
                    pathogen_domain = 'human'
                    natural_host = 'unknown'
                    skipped_no_pathogen += 1  # still imported, just flagged

                disease_domain = 'zoonotic' if pathogen_domain in ('zoonotic', 'animal') else 'human'

                # Determine what child rows we'll create so we can set
                # has_animal_event / has_human_case on the parent report.
                will_have_animal = pathogen_domain in ('zoonotic', 'animal')
                will_have_human = (
                    (pathogen_domain == 'zoonotic' and cases is not None and cases > 0)
                    or (pathogen_domain not in ('zoonotic', 'animal') and cases is not None)
                )

                # Parent disease_report — keep source name short (40 chars).
                completeness = 75 if cases is not None else 40
                cur.execute(UPSERT_REPORT, [
                    report_id, iso3, district, disease, disease_domain,
                    alert_date, cases or 0, tier,
                    (source_name or "")[:40], completeness,
                    will_have_animal, will_have_human,
                    ihr_notifiable, woah_listed,
                ])

                # Alert row
                cur.execute(UPSERT_ALERT, [
                    alert_id, report_id, iso3, district, disease,
                    tier, alert_date, alert_status,
                    ihr_notifiable, woah_listed,
                    None, lat, lng,
                ])

                # Human cases vs Animal Events logic
                if will_have_animal:
                    animals_dead = deaths or 0
                    humans_exposed = cases or 0
                    human_exposure = humans_exposed > 0
                    cur.execute(UPSERT_ANIMAL_EVENTS, [
                        report_id, report_id, natural_host[:50], animals_dead, alert_date, human_exposure, humans_exposed, woah_listed
                    ])
                    # If zoonotic and there are cases, add to human cases too
                    if pathogen_domain == 'zoonotic' and cases is not None and cases > 0:
                        cur.execute(UPSERT_HUMAN_CASES, [
                            report_id, report_id, alert_date, cases,
                        ])
                else:
                    # Pure human cases
                    if cases is not None:
                        cur.execute(UPSERT_HUMAN_CASES, [
                            report_id, report_id, alert_date, cases,
                        ])

                imported += 1
                if verbose_rows:
                    self.stdout.write(
                        f"  [T{tier}] {alert_id} {disease} ({iso3})"
                        f" cases={cases or 0} deaths={deaths or 0}"
                        f" animal={'Y' if will_have_animal else 'N'}"
                        f" human={'Y' if will_have_human else 'N'}"
                    )

        # Backfill: set has_animal_event / has_human_case on any RPT-SIG-
        # reports that already have child rows but missing flags (fixes
        # historical data from before this fix).
        with connection.cursor() as cur:
            cur.execute("""
                UPDATE oh_disease_reports d
                SET has_animal_event = TRUE
                WHERE d.report_id LIKE 'RPT-SIG-%%'
                  AND d.has_animal_event = FALSE
                  AND EXISTS (
                    SELECT 1 FROM oh_animal_events ae
                    WHERE ae.report_id = d.report_id
                  )
            """)
            backfill_animal = cur.rowcount

            cur.execute("""
                UPDATE oh_disease_reports d
                SET has_human_case = TRUE
                WHERE d.report_id LIKE 'RPT-SIG-%%'
                  AND d.has_human_case = FALSE
                  AND EXISTS (
                    SELECT 1 FROM oh_human_cases hc
                    WHERE hc.report_id = d.report_id
                  )
            """)
            backfill_human = cur.rowcount

        if backfill_animal or backfill_human:
            self.stdout.write(self.style.WARNING(
                f"Backfilled flags: {backfill_animal} animal, {backfill_human} human"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"Imported {imported} signals → oh_alerts "
            f"({skipped_no_pathogen} without pathogen profile)"
        ))
