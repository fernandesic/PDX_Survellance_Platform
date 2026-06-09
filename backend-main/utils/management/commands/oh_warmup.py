"""
One-time warmup for the One Health dashboard.

Run this ONCE after first deploy. After that, the APScheduler in
sentinel/scheduler.py keeps everything fresh automatically — sentinel
ingestion, alert conversion, agent/HITL refresh, weekly reference-data
pipeline. You should never need to run individual commands by hand again.

What this does:

  1. Bootstrap oh_agents table + seed default agents
  2. Bootstrap oh_hitl_actions table
  3. Trigger sentinel ingestion immediately (don't wait 15 min)
  4. Convert ingested signals → oh_alerts
  5. Run real reference-data pipeline (long; can be skipped with --no-pipeline)
  6. Refresh agent / HITL panels from real data

Usage:
    python manage.py oh_warmup                  # full warmup (~30-40 min)
    python manage.py oh_warmup --no-pipeline    # skip the slow reference fetch
"""
import os
import subprocess
import sys
import tempfile

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "One-time One Health dashboard warmup — run once after deploy."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-pipeline", action="store_true",
            help="Skip the slow weekly reference-data fetch (~30 min).",
        )
        parser.add_argument(
            "--no-ingest", action="store_true",
            help="Skip immediate sentinel ingestion (let scheduler do it).",
        )

    def handle(self, *args, **opts):
        steps_done = 0

        self._step("1. Bootstrap oh_agents table")
        try:
            call_command("bootstrap_oh_agents")
            steps_done += 1
        except Exception as e:
            self.stderr.write(f"   bootstrap_oh_agents failed: {e}")

        self._step("2. Bootstrap oh_hitl_actions table")
        try:
            call_command("bootstrap_oh_hitl")
            steps_done += 1
        except Exception as e:
            self.stderr.write(f"   bootstrap_oh_hitl failed: {e}")

        if not opts["no_ingest"]:
            self._step("3. Trigger sentinel ingestion now (so scheduler doesn't have to wait)")
            try:
                call_command("ingest_now", "--skip-import")
                steps_done += 1
            except Exception as e:
                self.stderr.write(f"   ingest_now failed: {e}")

            self._step("4. Convert sentinel signals → oh_alerts")
            try:
                call_command("import_sentinel_to_oh_alerts", since_hours=168)
                steps_done += 1
            except Exception as e:
                self.stderr.write(f"   import_sentinel_to_oh_alerts failed: {e}")

        if not opts["no_pipeline"]:
            self._step("5. Fetch real reference data (long; ~30 min — World Bank, WHO, NASA, WOAH, ...)")
            outdir = os.path.join(tempfile.gettempdir(), "oh-pipeline")
            os.makedirs(outdir, exist_ok=True)
            cmd = [
                sys.executable, "-m", "onehealth.pipeline",
                "--output-dir", outdir,
            ]
            if not os.getenv("ACLED_KEY"):
                cmd.append("--skip-acled")

            self.stdout.write(f"   (running: {' '.join(cmd)})")
            try:
                subprocess.run(cmd, check=False, timeout=3600)
            except subprocess.TimeoutExpired:
                self.stderr.write("   pipeline timed out after 1 h — partial data may still load")
            except Exception as e:
                self.stderr.write(f"   pipeline failed: {e}")

            self._step("6. Load reference CSVs into local Postgres")
            try:
                call_command("load_oh_pipeline_csvs", outdir)
                steps_done += 1
            except Exception as e:
                self.stderr.write(f"   load_oh_pipeline_csvs failed: {e}")
        else:
            self.stdout.write(self.style.WARNING(
                "5-6. Reference-data fetch skipped (--no-pipeline)"
            ))

        self._step("7. Refresh agent + HITL panels from real data")
        try:
            call_command("refresh_oh_agents")
            call_command("refresh_oh_hitl")
            steps_done += 1
        except Exception as e:
            self.stderr.write(f"   refresh failed: {e}")

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Warmup complete — {steps_done} steps succeeded.\n"
            "From now on, just keep Django running. The sentinel APScheduler\n"
            "will auto-refresh everything on these schedules:\n"
            "   • refresh_oh_agents             every  1 min\n"
            "   • refresh_oh_hitl               every  2 min\n"
            "   • import_sentinel_to_oh_alerts  every  5 min\n"
            "   • AI classifier (sentinel)      every  5 min\n"
            "   • GDELT ingest                  every 15 min\n"
            "   • AllAfrica RSS ingest          every 20 min\n"
            "   • spillover_cache refresh       every 30 min\n"
            "   • ReliefWeb ingest              every 30 min\n"
            "   • WHO News RSS ingest           every 60 min\n"
            "   • Weekly reference-data fetch   Sunday 02:00 UTC\n"
        ))

    def _step(self, label):
        self.stdout.write(self.style.HTTP_INFO(f"\n=== {label} ==="))
