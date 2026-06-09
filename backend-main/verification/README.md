# PDX Intelligence Verification & Feedback Loop

A Django app (`verification`) that sits **inside** the PDX backend and answers
the question PDX has never been able to answer about itself:

> *Did what we predicted actually happen — and how often are we right?*

It does not touch PDX's prediction logic. It **observes** it: freezing every
prediction as an immutable, fingerprinted snapshot, collecting real-world
outcomes in parallel, matching the two, scoring accuracy, and feeding the
results back so modules can self-correct.

Built to match PDX's existing conventions exactly — same app layout, the
`tenant` FK + PostgreSQL Row-Level Security pattern from `predictions`, the
`CustomTokenAuthentication` + `IsAuthenticated` stack, DRF `ViewSet` + `@action`
routing, and the list/detail serializer split.

---

## The four-stage pipeline

```
 CAPTURE  ─►  MATCH  ─►  SCORE  ─►  FEEDBACK
   │           │          │           │
PredictionSnapshot  MatchVerdict  ScoreCard      ReviewTicket
OutcomeEvent                      VeracityIndex  CalibrationRecord
```

1. **CAPTURE** (`services/capture.py`) — Freezes PDX predictions into
   `PredictionSnapshot` rows (immutable, SHA-256 fingerprinted) and gathers
   ground-truth `OutcomeEvent`s. Payloads missing `model_version` /
   `computed_at` are stored with `payload_complete=False` and surfaced, never
   silently dropped. SEIRDV scenario runs are captured as
   `is_counterfactual=True` and excluded from scoring. **The Alerts & Incidents
   dashboards (`sentinel.Signal` + `hdis.Alert`) are captured too**: each
   signal/alert becomes an `alert_cluster` prediction, and its own analyst
   resolution (`validated` → real, `dismissed` → false alarm, unresolved →
   flagged unverifiable) becomes the ground truth — so every row on those
   dashboards is traceable.

2. **MATCH** (`services/matching.py`) — Three-axis match (disease? geography?
   time window?) producing a verdict: **Confirmed Hit / Partial Hit / Miss /
   False Alarm / Pending / Excluded**, with stored evidence for human audit.
   Per-prediction-class deciders handle risk levels, case counts, imminent
   classification, alert-vs-DON lead time, probabilities (Brier), intervention
   tiers (weighted κ), and epi-curve intervals (WIS).

3. **SCORE** (`services/scoring.py`) — Aggregates verdicts into the full metric
   suite (Hit Rate, Precision, Recall, F1, False-Alarm Rate, Brier, WIS,
   weighted Cohen κ, mean Lead Time, reliability diagram) at six granularities,
   and rolls them into a **0–100 Veracity Index** per module and platform-wide.

4. **FEEDBACK** (`services/feedback.py`) — Auto-opens `ReviewTicket`s for
   significant Misses / False Alarms, and computes `CalibrationRecord`s
   (confidence multiplier/offset) that PDX modules query to auto-adjust their
   outputs.

Plus an **Ebola PHEIC track**: an append-only `EbolaEvent` log for the Outbreak
Workspace SSE stream and a `SourceAudit` table for adaptor-health / data-gap
tracking, with lead time measured against the **17 May 2026** declaration.

---

## Install (inside the PDX backend)

1. **Copy the app** into the backend next to `predictions/`:

   ```
   backend/verification/
   ```

2. **Register it** in `datarepr/settings/base.py` (after `predictions`):

   ```python
   INSTALLED_APPS = [
       ...
       'predictions',
       'verification',      # ← add
       'pami',
       'pip_dashboard',
   ]
   ```

3. **Mount the routes** in `datarepr/urls.py`:

   ```python
   path('api/v1/verification/', include('verification.urls')),
   ```

4. **Migrate** (creates tables, then enables RLS):

   ```bash
   python manage.py migrate verification
   ```

5. **Verify the schema is in sync** (should report no changes):

   ```bash
   python manage.py makemigrations --check verification
   ```

No new dependencies — it uses only Django, DRF, and `requests` (all already in
`requirements.txt`). `requests` is needed only for detached-service HTTP
collection; the in-process collectors need nothing extra.

---

## Run the pipeline

```bash
# CAPTURE — snapshot current predictions + scenario runs
python manage.py capture_predictions --horizon 30

# MATCH → SCORE → FEEDBACK over everything whose window has closed
python manage.py run_verification

# stage subsets
python manage.py run_verification --match-only
python manage.py run_verification --score-only
python manage.py run_verification --feedback-only --since 2026-01-01
```

### Suggested cron (PDX already uses `django_crontab`)

```python
CRONJOBS = [
    ('0 */6 * * *', 'django.core.management.call_command', ['capture_predictions']),
    ('30 2 * * *',  'django.core.management.call_command', ['run_verification']),
]
```

---

## API surface (`/api/v1/verification/`)

| Route | Purpose |
|---|---|
| `snapshots/` | Frozen predictions (filter: `module`, `country`, `disease`, `prediction_class`, `counterfactual`) |
| `snapshots/incomplete/` | Predictions captured without `model_version`/`computed_at` (gap report) |
| `snapshots/{id}/audit/` | Full payload + fingerprint for tamper audit |
| `outcomes/` | Ground-truth events |
| `verdicts/` | Match verdicts (filter: `verdict`, `module`, `country`) |
| `verdicts/summary/` | Verdict distribution KPIs |
| `verdicts/alerts-coverage/` | **Verifiability of the Alerts & Incidents dashboards** — real vs false-alarm vs unverified, with per-country breakdown |
| `verdicts/ebola-lead-time/` | Earliest Ebola signal vs the PHEIC declaration |
| `scorecards/` · `scorecards/latest/` | Accuracy metrics by slice |
| `veracity/` · `veracity/current/` | The 0–100 Veracity Index (platform + per module) |
| `tickets/` · `tickets/{id}/resolve/` | Review tickets (GET/PATCH) |
| `calibration/lookup/?module=&disease=` | **The endpoint PDX modules call** for a confidence multiplier |
| `ebola-events/` · `ebola-events/stats/` | Ebola PHEIC event log |
| `adaptor-health/current/` | Latest freshness status per adaptor |

All endpoints require authentication and are tenant-scoped automatically via
RLS — a country user sees only their country's verification data; continental
super-admins see everything.

---

## How a PDX module consumes calibration

At prediction time, a module asks the verification app how trustworthy its past
confidence has been and scales accordingly:

```python
import requests

def calibrated_confidence(raw_conf, module, disease, token, base):
    r = requests.get(
        f"{base}/api/v1/verification/calibration/lookup/",
        params={"module": module, "disease": disease},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    return max(0.0, min(1.0, raw_conf * r["suggested_multiplier"] + r["suggested_offset"]))
```

If no calibration data exists yet the endpoint returns a pass-through
(`multiplier=1.0, offset=0.0`), so wiring it in is always safe.

---

## Design notes / honoured constraints

- **Counterfactuals never scored.** SEIRDV scenario runs are captured for the
  audit trail but flagged `is_counterfactual=True` → verdict `EXCLUDED`.
- **Provenance gaps are visible, not hidden.** Missing `model_version`/
  `computed_at` ⇒ `payload_complete=False` ⇒ excluded from honest backtests and
  listed at `snapshots/incomplete/`.
- **Immutability.** Snapshots and outcomes are fingerprinted on save;
  re-capturing an identical payload is idempotent and tamper is detectable.
- **Bundibugyo stays distinct.** Disease identity is carried verbatim from the
  source payload; the app never merges BDBV with Zaire-ebolavirus.
- **Lead time anchor.** Ebola imminent/spillover lead time is measured against
  the 17 May 2026 PHEIC declaration (`services/matching.PHEIC_DECLARATION`).
- **No schema changes to PDX.** The app only reads PDX models/endpoints.

---

## What you should run to confirm before deploying

This was authored offline against the real PDX source tree, so the schema and
conventions match — but run these in your environment to be certain:

```bash
pytest verification/tests/ -v                          # ~45 tests, all should pass
python manage.py makemigrations --check verification   # expect: no changes
python manage.py migrate verification                  # creates tables + RLS
python manage.py capture_predictions                   # smoke-test capture
python manage.py run_verification                      # smoke-test pipeline
```

## Production-readiness status

Closed and covered by tests:
- Four-stage pipeline (capture, match, score, feedback) end to end.
- Alerts & Incidents verification + the `alerts-coverage` report.
- Real Telegram + email notifications (PDX channels), degrading gracefully.
- Official ground-truth outcomes (WHO DON / outbreak / cross-border) derived
  from validated signals, so predictions don't sit Pending forever.
- Stale-pending auto-resolution with a configurable grace period.
- ~45 tests: scoring/matching math (run anywhere) + full DB pipeline.

One genuine caveat the deployer must handle:
- The **Outbreak Workspace SSE / adaptor-health endpoints** are part of the
  v2.0 change brief and are not in the current backend repo. The HTTP
  collectors (`ingest_outbreak_events`, `ingest_adaptor_health`) are written
  defensively against the documented payload shape; confirm one real sample
  payload and adjust the field keys if they differ. Everything else reads real,
  verified PDX models.

