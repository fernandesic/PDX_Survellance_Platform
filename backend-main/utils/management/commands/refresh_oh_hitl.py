"""
Refresh oh_hitl_actions from real outbreak data.

Scans oh_alerts and generates pending Human-in-the-Loop actions based on
real triggers:

  * APPROVE — Tier-4 IHR-notifiable alerts → PHEIC notification draft
  * INFORM  — Tier-4 alerts auto-dispatched to district vet officers
  * REVIEW  — Joint zoonotic alerts (IHR + WOAH) needing multi-agency draft

Resolved actions (approved/dismissed/acknowledged) are NOT regenerated —
once a user has acted, the row stays and a new one only appears for a
genuinely new alert.

Usage: python manage.py refresh_oh_hitl
"""
from django.core.management.base import BaseCommand
from django.db import connection

from utils.tenant_tasks import tenant_context


# Generate at most this many of each kind to avoid swamping the panel
MAX_PER_KIND = 5


PENDING_PHEIC_SQL = """
SELECT a.alert_id, a.disease_name, a.country_iso3, c.country_name,
       a.alert_date, a.district
FROM oh_alerts a
LEFT JOIN oh_countries c ON c.iso3 = a.country_iso3
WHERE a.alert_tier = 4
  AND a.ihr_notifiable = TRUE
  AND a.status != 'closed'
ORDER BY a.alert_date DESC
LIMIT %s
"""

PENDING_INFORM_SQL = """
SELECT a.alert_id, a.disease_name, a.country_iso3, c.country_name,
       a.alert_date, a.district
FROM oh_alerts a
LEFT JOIN oh_countries c ON c.iso3 = a.country_iso3
WHERE a.alert_tier = 4
  AND a.woah_listed = TRUE
  AND a.status != 'closed'
ORDER BY a.alert_date DESC
LIMIT %s
"""

PENDING_JOINT_SQL = """
SELECT a.alert_id, a.disease_name, a.country_iso3, c.country_name,
       a.alert_date, a.district
FROM oh_alerts a
LEFT JOIN oh_countries c ON c.iso3 = a.country_iso3
WHERE a.alert_tier >= 3
  AND a.ihr_notifiable = TRUE
  AND a.woah_listed = TRUE
  AND a.status != 'closed'
ORDER BY a.alert_date DESC
LIMIT %s
"""

UPSERT_HITL_SQL = """
INSERT INTO oh_hitl_actions
    (action_id, kind, title, description, severity, requested_by, related_alert, status)
VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
ON CONFLICT (action_id) DO UPDATE SET
    title         = EXCLUDED.title,
    description   = EXCLUDED.description,
    severity      = EXCLUDED.severity,
    related_alert = EXCLUDED.related_alert
WHERE oh_hitl_actions.status = 'pending'
"""


def _fmt_country(country_name, iso3, district):
    base = country_name or iso3 or ""
    if district:
        return f"{base} ({district})"
    return base


class Command(BaseCommand):
    help = "Refresh the HITL action queue from real outbreak alerts."

    def handle(self, *args, **options):
        with tenant_context('0'):
            self._run()

    def _run(self):
        created = 0
        with connection.cursor() as cur:
            # 1. PHEIC approvals (Tier-4 IHR alerts)
            cur.execute(PENDING_PHEIC_SQL, [MAX_PER_KIND])
            for row in cur.fetchall():
                aid, disease, iso3, cname, dt, district = row
                where = _fmt_country(cname, iso3, district)
                action_id = f"HITL-PHEIC-{aid}"
                title = f"⚠ Approve: PHEIC Notification — {disease}"
                desc = (
                    f"Policy Compiler requests approval to send IHR Art.12 "
                    f"preliminary notification to WHO Geneva for {disease} "
                    f"event in {where} (alert {aid}, dated {dt})."
                )
                cur.execute(UPSERT_HITL_SQL, [
                    action_id, "approve", title, desc,
                    "amber", "policy-compiler", aid,
                ])
                created += cur.rowcount

            # 2. INFORM (auto-dispatched veterinary notifications)
            cur.execute(PENDING_INFORM_SQL, [MAX_PER_KIND])
            for row in cur.fetchall():
                aid, disease, iso3, cname, dt, district = row
                where = _fmt_country(cname, iso3, district)
                action_id = f"HITL-INFORM-{aid}"
                title = f"ℹ Inform: {disease} — {iso3}"
                desc = (
                    f"Risk Sentinel notified District Vet Officers about "
                    f"{disease} in {where}. Auto-dispatched. For awareness only."
                )
                cur.execute(UPSERT_HITL_SQL, [
                    action_id, "inform", title, desc,
                    "cobalt", "risk-sentinel", aid,
                ])
                created += cur.rowcount

            # 3. REVIEW (joint WHO/FAO/WOAH zoonotic drafts)
            cur.execute(PENDING_JOINT_SQL, [MAX_PER_KIND])
            for row in cur.fetchall():
                aid, disease, iso3, cname, dt, district = row
                where = _fmt_country(cname, iso3, district)
                action_id = f"HITL-JOINT-{aid}"
                title = f"⚠ Review: Joint WHO/FAO/WOAH alert — {disease}"
                desc = (
                    f"Partner Orchestrator drafted a joint zoonotic alert "
                    f"for {disease} in {where} (IHR + WOAH listed). "
                    f"Review draft before dispatch."
                )
                cur.execute(UPSERT_HITL_SQL, [
                    action_id, "approve", title, desc,
                    "amber", "partner-orchestrator", aid,
                ])
                created += cur.rowcount

        self.stdout.write(self.style.SUCCESS(
            f"HITL refreshed — {created} pending actions ready."
        ))
