"""
Bootstrap the oh_hitl_actions table.

Creates the table if it does not exist. Unlike the agents bootstrap, no
seed rows are inserted — pending actions are derived from real outbreak
data by `refresh_oh_hitl` based on what's actually happening in oh_alerts.

Usage: python manage.py bootstrap_oh_hitl
"""
from django.core.management.base import BaseCommand
from django.db import connection


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS oh_hitl_actions (
    action_id      VARCHAR(40)   PRIMARY KEY,
    kind           VARCHAR(20)   NOT NULL,
    title          VARCHAR(200)  NOT NULL,
    description    TEXT,
    severity       VARCHAR(20),
    requested_by   VARCHAR(40),
    related_alert  VARCHAR(20),
    status         VARCHAR(20)   DEFAULT 'pending',
    created_at     TIMESTAMPTZ   DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    resolved_by    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_hitl_pending ON oh_hitl_actions(status, created_at DESC);
"""


class Command(BaseCommand):
    help = "Create the oh_hitl_actions table for the One Health HITL panel."

    def handle(self, *args, **options):
        with connection.cursor() as cur:
            cur.execute(CREATE_SQL)
        self.stdout.write(self.style.SUCCESS(
            "oh_hitl_actions table ready. Run `refresh_oh_hitl` to populate."
        ))
