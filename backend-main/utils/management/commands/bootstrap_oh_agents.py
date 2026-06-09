"""
Bootstrap the oh_agents table for the One Health dashboard.

Creates the table if it does not exist and seeds it with the five default
agents that the dashboard panel currently shows. Idempotent: re-running
will not duplicate rows.

Usage: python manage.py bootstrap_oh_agents
"""
from django.core.management.base import BaseCommand
from django.db import connection


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS oh_agents (
    agent_id        VARCHAR(40)   PRIMARY KEY,
    name            VARCHAR(80)   NOT NULL,
    icon            VARCHAR(8),
    status          VARCHAR(20)   NOT NULL,
    status_label    VARCHAR(20)   NOT NULL,
    description     TEXT,
    phase           VARCHAR(20),
    sort_order      SMALLINT      DEFAULT 0,
    last_heartbeat  TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
"""

SEED_AGENTS = [
    ("risk-sentinel", "Risk Sentinel", "🛰", "running", "RUNNING",
     "Scanning 6 feeds · HPAI pattern in W. Africa", "Phase III", 1),
    ("policy-compiler", "Policy Compiler", "📋", "alert", "AWAITING",
     "IHR Art.12 threshold met · PHEIC draft ready", "Phase III", 2),
    ("ask-triad", "Ask TRIAD", "💬", "running", "ACTIVE",
     "Processing spillover risk query for DRC→UGA", "Phase III", 3),
    ("digital-twins", "Digital Twins", "🌍", "idle", "IDLE",
     "47 country models ready on demand", "Phase III", 4),
    ("partner-orchestrator", "Partner Orchestrator", "🔗", "pending", "QUEUED",
     "Drafting WHO/FAO/WOAH joint HPAI alert", "Phase III", 5),
]

UPSERT_SQL = """
INSERT INTO oh_agents
    (agent_id, name, icon, status, status_label, description, phase, sort_order)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (agent_id) DO UPDATE SET
    name         = EXCLUDED.name,
    icon         = EXCLUDED.icon,
    status       = EXCLUDED.status,
    status_label = EXCLUDED.status_label,
    description  = EXCLUDED.description,
    phase        = EXCLUDED.phase,
    sort_order   = EXCLUDED.sort_order,
    updated_at   = NOW();
"""


class Command(BaseCommand):
    help = "Create oh_agents table and seed the five default One Health agents."

    def handle(self, *args, **options):
        with connection.cursor() as cur:
            cur.execute(CREATE_SQL)
            self.stdout.write(self.style.SUCCESS("oh_agents table ready."))

            for row in SEED_AGENTS:
                cur.execute(UPSERT_SQL, row)
            self.stdout.write(
                self.style.SUCCESS(f"Seeded {len(SEED_AGENTS)} agents.")
            )
