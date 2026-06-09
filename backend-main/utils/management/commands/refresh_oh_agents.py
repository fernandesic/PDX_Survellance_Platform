"""
Refresh oh_agents table from real system state.

Each "agent" in the One Health dashboard is derived from actual data
already flowing through the platform — sentinel signals, spillover cache,
active alerts. No external "agent status" API exists; this command is
the source of truth.

Run periodically (cron / django_crontab / manual):
    python manage.py refresh_oh_agents

Default cadence: every 30 seconds (see crontab.py if scheduling).
"""
from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone as dj_tz

from utils.tenant_tasks import tenant_context


def _humanise_age(dt):
    """Return 'Nm ago' / 'Nh ago' for a timezone-aware datetime."""
    if dt is None:
        return "never"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = dj_tz.now() - dt
    secs = int(delta.total_seconds())
    if secs < 60:
        return f"{secs}s ago"
    if secs < 3600:
        return f"{secs // 60}m ago"
    if secs < 86400:
        return f"{secs // 3600}h ago"
    return f"{secs // 86400}d ago"


# ── Agent derivation logic ────────────────────────────────────────────────


def derive_risk_sentinel():
    """Risk Sentinel — derived from sentinel_signal table.

    External upstream sources (already integrated via sentinel/ingestion.py):
      ProMED Mail, WHO Disease Outbreak News, ReliefWeb, GDELT, HealthMap.
    """
    with connection.cursor() as cur:
        # Hourly throughput
        cur.execute("""
            SELECT count(*) FROM sentinel_signal
            WHERE created_at > NOW() - INTERVAL '1 hour'
        """)
        hour_count = cur.fetchone()[0]

        # Latest signal — prefer one with a disease_name set so the agent
        # description shows something meaningful (otherwise we get
        # "latest: unknown ...").
        cur.execute("""
            SELECT created_at, disease_name, location_country
            FROM sentinel_signal
            WHERE disease_name IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
        """)
        row = cur.fetchone()
        if row is None:
            # Fall back to any latest signal if none have disease_name
            cur.execute("""
                SELECT created_at, disease_name, location_country
                FROM sentinel_signal
                ORDER BY created_at DESC LIMIT 1
            """)
            row = cur.fetchone()

        # Distinct active source feeds last 24h
        # ingestion_source is the string label set by sentinel/ingestion.py
        # (e.g. 'ALLAFRICA', 'GDELT', 'WHO_NEWS') — more reliable than the
        # SourceCredibility FK which is often NULL.
        cur.execute("""
            SELECT count(DISTINCT ingestion_source)
            FROM sentinel_signal
            WHERE created_at > NOW() - INTERVAL '24 hours'
              AND ingestion_source IS NOT NULL
        """)
        feed_count = cur.fetchone()[0] or 0

    if row:
        latest_at, disease, country = row
        is_fresh = (dj_tz.now() - latest_at).total_seconds() < 1800  # 30 min
        status = "running" if is_fresh else "alert"
        label = "RUNNING" if is_fresh else "STALE"
        desc = (
            f"Scanning {feed_count} feeds · {hour_count} signals/hr · "
            f"latest: {disease or 'unknown'} ({country or '—'}) {_humanise_age(latest_at)}"
        )
    else:
        status, label = "alert", "NO DATA"
        desc = "No sentinel signals ingested yet"

    return status, label, desc


def derive_ask_triad():
    """Ask TRIAD — derived from sentinel signals being classified by LLM.

    External upstream: Anthropic Claude API (via utils/llm_service.py).
    """
    with connection.cursor() as cur:
        # Recently classified signals (anything that has disease_name set
        # within last 10 min was likely processed by the LLM classifier)
        cur.execute("""
            SELECT count(*) FROM sentinel_signal
            WHERE created_at > NOW() - INTERVAL '10 minutes'
              AND disease_name IS NOT NULL
        """)
        recent_classified = cur.fetchone()[0]

        # Top recent disease being processed
        cur.execute("""
            SELECT disease_name, count(*) AS n
            FROM sentinel_signal
            WHERE created_at > NOW() - INTERVAL '1 hour'
              AND disease_name IS NOT NULL
            GROUP BY disease_name
            ORDER BY n DESC LIMIT 1
        """)
        top = cur.fetchone()

    if recent_classified > 0:
        status, label = "running", "ACTIVE"
        if top:
            desc = f"Classified {recent_classified} signals in last 10m · top topic: {top[0]}"
        else:
            desc = f"Classified {recent_classified} signals in last 10m"
    else:
        status, label = "idle", "READY"
        desc = "Claude API ready · awaiting query"

    return status, label, desc


def derive_digital_twins():
    """Digital Twins — country forecast/spillover models cached.

    External upstream sources (via pipeline.py):
      NASA POWER, WHO GHO, IUCN Red List, GBIF, World Bank.
    """
    with connection.cursor() as cur:
        # Cache table may not exist yet if spillover_engine never ran
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'oh_spillover_cache'
            )
        """)
        if not cur.fetchone()[0]:
            return "idle", "EMPTY", "No country models cached yet"

        cur.execute("""
            SELECT count(DISTINCT iso3), max(computed_at)
            FROM oh_spillover_cache
        """)
        country_count, last_computed = cur.fetchone()

    country_count = country_count or 0
    if country_count == 0:
        return "idle", "EMPTY", "No country models cached yet"

    age_label = _humanise_age(last_computed) if last_computed else "—"
    return ("idle", "READY",
            f"{country_count} country models cached · refreshed {age_label}")


def derive_policy_compiler():
    """Policy Compiler — derived from IHR-notifiable high-tier alerts.

    Triggers when a Tier-4 alert with IHR Annex 2 flag exists.
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT count(*) FROM oh_alerts
            WHERE alert_tier = 4
              AND ihr_notifiable = TRUE
              AND status != 'closed'
        """)
        pheic_candidates = cur.fetchone()[0]

        cur.execute("""
            SELECT disease_name, country_iso3 FROM oh_alerts
            WHERE alert_tier = 4
              AND ihr_notifiable = TRUE
              AND status != 'closed'
            ORDER BY alert_date DESC LIMIT 1
        """)
        top = cur.fetchone()

    if pheic_candidates > 0:
        status, label = "alert", "AWAITING"
        if top:
            desc = (f"IHR Art.12 threshold met for {pheic_candidates} event(s) · "
                    f"top: {top[0]} ({top[1]})")
        else:
            desc = f"IHR Art.12 threshold met for {pheic_candidates} event(s)"
    else:
        status, label = "idle", "MONITORING"
        desc = "No PHEIC-eligible events in active alerts"

    return status, label, desc


def derive_partner_orchestrator():
    """Partner Orchestrator — joint WHO/FAO/WOAH notifications.

    Triggers when an alert is BOTH IHR-notifiable AND WOAH-listed
    (i.e., zoonotic spillover requiring multi-agency coordination).
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT count(*) FROM oh_alerts
            WHERE alert_tier >= 3
              AND ihr_notifiable = TRUE
              AND woah_listed = TRUE
              AND status != 'closed'
        """)
        joint_count = cur.fetchone()[0]

        cur.execute("""
            SELECT disease_name FROM oh_alerts
            WHERE alert_tier >= 3
              AND ihr_notifiable = TRUE
              AND woah_listed = TRUE
              AND status != 'closed'
            ORDER BY alert_date DESC LIMIT 1
        """)
        top = cur.fetchone()

    if joint_count > 0:
        status, label = "pending", "QUEUED"
        if top:
            desc = f"Drafting WHO/FAO/WOAH joint alert for {top[0]} ({joint_count} active)"
        else:
            desc = f"Drafting WHO/FAO/WOAH joint alert ({joint_count} active)"
    else:
        status, label = "idle", "MONITORING"
        desc = "No joint zoonotic alerts active"

    return status, label, desc


# ── Persistence ───────────────────────────────────────────────────────────

UPDATE_SQL = """
UPDATE oh_agents SET
    status = %s,
    status_label = %s,
    description = %s,
    last_heartbeat = NOW(),
    updated_at = NOW()
WHERE agent_id = %s
"""


AGENTS_TO_REFRESH = [
    ("risk-sentinel", derive_risk_sentinel),
    ("ask-triad", derive_ask_triad),
    ("digital-twins", derive_digital_twins),
    ("policy-compiler", derive_policy_compiler),
    ("partner-orchestrator", derive_partner_orchestrator),
]


class Command(BaseCommand):
    help = "Refresh oh_agents row data from real system state (sentinel, spillover cache, alerts)."

    def handle(self, *args, **options):
        # sentinel_signal has RLS enabled — set super-admin context so the
        # derivation queries can see signals across all tenants.
        with tenant_context('0'):
            self._run()

    def _run(self):
        updated = 0
        with connection.cursor() as cur:
            for agent_id, deriver in AGENTS_TO_REFRESH:
                try:
                    status, label, desc = deriver()
                except Exception as e:
                    self.stderr.write(self.style.WARNING(
                        f"  {agent_id}: derivation failed — {e}"
                    ))
                    continue

                cur.execute(UPDATE_SQL, [status, label, desc, agent_id])
                if cur.rowcount > 0:
                    updated += 1
                    self.stdout.write(f"  {agent_id}: [{label}] {desc}")
                else:
                    self.stdout.write(self.style.WARNING(
                        f"  {agent_id}: row missing (run bootstrap_oh_agents first)"
                    ))

        self.stdout.write(self.style.SUCCESS(f"Refreshed {updated}/{len(AGENTS_TO_REFRESH)} agents."))
