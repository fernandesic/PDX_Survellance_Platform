"""
STAGE 1 — CAPTURE
=================

Collectors that freeze PDX predictions into immutable PredictionSnapshots and
gather real-world OutcomeEvents in parallel. Two ingestion paths are
supported and both flow through the same normalisers:

  * In-process: read PDX's own Django models directly (predictions.*,
    onehealth, sentinel, …). Fast, no auth, used when the verification app is
    installed inside the PDX project (the deployment the Proposal assumes —
    "a separate service that observes PDX", §9, but co-located).

  * Over-HTTP: pull JSON from datarepr.duckdns.org/api/v1/* with the service
    JWT. Used if verification runs as a detached service. Normalisers accept
    raw dicts so the source doesn't matter.

Every snapshot is fingerprinted and provenance-checked on save (see
PredictionSnapshot.save). Counterfactual SEIRDV runs are captured with
is_counterfactual=True (Change Brief §2). Re-capturing an identical payload is
idempotent via the fingerprint.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from verification.models import (
    PredictionSnapshot, OutcomeEvent, EbolaEvent, SourceAudit,
)
from verification.services.tenancy import resolve_record_tenant, tenant_for_iso

logger = logging.getLogger(__name__)


def _dt(value, default=None):
    """Coerce a value to an aware datetime."""
    if value is None:
        return default
    if hasattr(value, 'tzinfo'):
        if value.tzinfo is None:
            return timezone.make_aware(value)
        return value
    parsed = parse_datetime(str(value))
    if parsed and parsed.tzinfo is None:
        parsed = timezone.make_aware(parsed)
    return parsed or default


# ─────────────────────────────────────────────────────────────────────
# Normalised snapshot writer (single funnel for all collectors)
# ─────────────────────────────────────────────────────────────────────

def capture_snapshot(*, source_module, prediction_class, country_iso,
                     raw_payload, window_start, window_end,
                     country_name='', disease_name='', province='', district='',
                     predicted_label='', predicted_value=None,
                     predicted_probability=None, predicted_interval=None,
                     predicted_ranking=None, horizon_days=None,
                     model_version='', computed_at=None,
                     is_counterfactual=False, scenario_run_id=None,
                     source_endpoint='', user=None):
    """
    Idempotently freeze one prediction. If a snapshot with the same fingerprint
    already exists it is returned unchanged (no duplicate, no tamper).
    """
    fingerprint = PredictionSnapshot.compute_fingerprint(raw_payload)
    existing = PredictionSnapshot.objects.filter(payload_fingerprint=fingerprint).first()
    if existing:
        return existing, False

    # Defensive truncation: clip strings so a single over-long upstream value
    # can't fail an entire capture batch.
    def _clip(v, n):
        s = str(v) if v is not None else ''
        return s[:n]

    snap = PredictionSnapshot(
        source_module=_clip(source_module, 20),
        prediction_class=_clip(prediction_class, 30),
        country_iso=_clip(country_iso, 3),
        country_name=_clip(country_name, 100),
        disease_name=_clip(disease_name, 50),
        province=_clip(province, 200),
        district=_clip(district, 200),
        predicted_label=_clip(predicted_label, 50),
        predicted_value=predicted_value,
        predicted_probability=predicted_probability,
        predicted_interval=predicted_interval or {},
        predicted_ranking=predicted_ranking or [],
        horizon_days=horizon_days,
        window_start=_dt(window_start, timezone.now()),
        window_end=_dt(window_end, timezone.now()),
        model_version=_clip(model_version, 100),
        computed_at=_dt(computed_at),
        is_counterfactual=is_counterfactual,
        scenario_run_id=scenario_run_id,
        raw_payload=raw_payload,
        source_endpoint=source_endpoint,
        tenant=resolve_record_tenant(country_iso, user),
    )
    snap.save()  # fingerprint + provenance completeness computed here
    if not snap.payload_complete:
        logger.warning(
            'Snapshot %s captured WITHOUT model_version/computed_at — '
            'flagged payload_complete=False (Change Brief §6).', snap.pk,
        )
    return snap, True


def capture_outcome(*, outcome_type, source_feed, country_iso, occurred_at,
                    raw_payload, disease_name='', country_name='',
                    province='', district='', observed_label='',
                    observed_value=None, observed_cases=None, observed_deaths=None,
                    evidence_url='', evidence_snapshot_url='', iso_week='',
                    user=None):
    """Idempotently record one ground-truth outcome."""
    fingerprint = PredictionSnapshot.compute_fingerprint(raw_payload)
    existing = OutcomeEvent.objects.filter(
        payload_fingerprint=fingerprint, outcome_type=outcome_type,
    ).first()
    if existing:
        return existing, False
    def _clip(v, n):
        return (v or '')[:n] if isinstance(v, str) else (v or '')
    outcome = OutcomeEvent.objects.create(
        outcome_type=_clip(outcome_type, 30),
        source_feed=_clip(source_feed, 30),
        country_iso=_clip(country_iso, 3),
        country_name=_clip(country_name, 100),
        disease_name=_clip(disease_name, 50),
        province=_clip(province, 200),
        district=_clip(district, 200),
        observed_label=_clip(observed_label, 50),
        observed_value=observed_value,
        observed_cases=observed_cases,
        observed_deaths=observed_deaths,
        occurred_at=_dt(occurred_at, timezone.now()),
        iso_week=iso_week,
        evidence_url=evidence_url,
        evidence_snapshot_url=evidence_snapshot_url,
        raw_payload=raw_payload,
        tenant=resolve_record_tenant(country_iso, user),
    )
    return outcome, True


# ─────────────────────────────────────────────────────────────────────
# In-process collectors (read PDX models directly)
# ─────────────────────────────────────────────────────────────────────

def collect_predictions_module(horizon_days=30):
    """
    Snapshot the composite OutbreakPrediction table (#1 risk_level,
    #2 case_count). Window = now → now + horizon.
    """
    from predictions.models import OutbreakPrediction
    now = timezone.now()
    created = 0
    for p in OutbreakPrediction.objects.all().iterator():
        # Anchor the window to the underlying prediction_date so already-closed
        # windows can be matched/scored immediately. Falls back to `now` when
        # the upstream record lacks a prediction_date.
        anchor = p.prediction_date or now
        window_start = anchor
        window_end = anchor + timedelta(days=horizon_days)
        payload = {
            'id': p.id, 'country_iso': p.country_iso, 'disease': p.disease_name,
            'composite_risk_score': p.composite_risk_score, 'risk_level': p.risk_level,
            'predicted_cases_30d': p.predicted_cases_30d,
            'confidence': p.confidence,
            'prediction_date': p.prediction_date.isoformat() if p.prediction_date else None,
            'source_model': getattr(p.source_model, 'name', None),
        }
        model_version = getattr(p.source_model, 'name', '') or ''
        _, was_new = capture_snapshot(
            source_module='predictions', prediction_class='risk_level',
            country_iso=p.country_iso, country_name=p.country_name,
            disease_name=p.disease_name, predicted_label=p.risk_level,
            horizon_days=horizon_days, window_start=window_start, window_end=window_end,
            model_version=model_version, computed_at=p.prediction_date,
            raw_payload=payload, source_endpoint='predictions.OutbreakPrediction',
        )
        created += int(was_new)
        # Companion case-count snapshot (#2).
        if p.predicted_cases_30d:
            cc_payload = dict(payload, _class='case_count')
            _, n = capture_snapshot(
                source_module='predictions', prediction_class='case_count',
                country_iso=p.country_iso, country_name=p.country_name,
                disease_name=p.disease_name, predicted_value=float(p.predicted_cases_30d),
                horizon_days=horizon_days, window_start=window_start, window_end=window_end,
                model_version=model_version, computed_at=p.prediction_date,
                raw_payload=cc_payload, source_endpoint='predictions.OutbreakPrediction',
            )
            created += int(n)
    return created


def collect_scenario_runs():
    """
    Capture SEIRDV scenario runs as COUNTERFACTUAL snapshots (Change Brief §2).
    These are segregated and never scored as forecasts — only their parameter
    set is preserved for the scenario audit.
    """
    from predictions.models import ScenarioRun
    now = timezone.now()
    created = 0
    for run in ScenarioRun.objects.all().iterator():
        payload = {
            'run_id': run.id, 'status': run.status,
            'parameters_snapshot': run.parameters_snapshot,
            'summary_stats': run.summary_stats,
            'scenario': getattr(run.scenario, 'name', None),
            'pathogen': getattr(run.scenario, 'pathogen', ''),
            'country_iso': getattr(run.scenario, 'country_iso', ''),
        }
        iso = getattr(run.scenario, 'country_iso', '') or ''
        disease = getattr(run.scenario, 'pathogen', '') or ''
        _, n = capture_snapshot(
            source_module='predictions', prediction_class='epi_curve_wis',
            country_iso=iso, disease_name=disease,
            window_start=run.created_at or now, window_end=now,
            model_version='wbepi_seirdv', computed_at=run.completed_at or run.created_at,
            is_counterfactual=True, scenario_run_id=run.id,
            raw_payload=payload, source_endpoint='predictions.ScenarioRun',
        )
        created += int(n)
    return created


def collect_alerts_incidents(window_days=30, signal_limit=None):
    """
    Capture the Alerts & Incidents dashboards (sentinel.Signal + hdis.Alert) as
    verifiable predictions, and turn each item's own resolution into ground
    truth so the dashboard can show which alerts held up.

    The verification angle for alerts is special: a sentinel Signal is *both* a
    prediction ("this is a real disease/hazard signal worth acting on") and
    carries its own analyst resolution via `status`:

        validated  → an analyst confirmed it was real     → OutcomeEvent (Hit)
        dismissed  → an analyst judged it a false alarm    → no outcome (FA)
        new/triaged→ unresolved; if its window has closed   → flagged as a
                     data gap (shown as "unverified" on the dashboard)

    So every row on the Alerts & Incidents dashboard becomes traceable: real,
    false alarm, or not-yet-verifiable. Each captured signal/alert is a
    PredictionSnapshot of class `alert_cluster`; resolved ones also emit a
    matching OutcomeEvent so the MATCH stage can score them automatically.

    Returns counts of snapshots and outcomes created.
    """
    from sentinel.models import Signal
    now = timezone.now()
    snaps = outcomes = 0

    signals = Signal.objects.all().order_by('-created_at')
    if signal_limit:
        signals = signals[:signal_limit]

    for sig in signals.iterator():
        iso = (sig.location_country_iso or '').strip()
        disease = (sig.disease_name or '').strip()
        created_at = sig.created_at or now
        window_end = created_at + timedelta(days=window_days)
        # Priority/AI severity express how strongly the signal asserts a real
        # event — we record it as the predicted label for audit.
        label = sig.ai_classification or sig.priority or ''
        payload = {
            'kind': 'sentinel_signal',
            'signal_id': sig.id,
            'signal_type': sig.signal_type,
            'disease_name': disease,
            'priority': sig.priority,
            'status': sig.status,
            'confidence_score': sig.confidence_score,
            'source_name': sig.source_name,
            'source_tier': sig.source_tier,
            'source_url': sig.source_url,
            'location_country': sig.location_country,
            'location_country_iso': iso,
            'ai_classification': sig.ai_classification,
            'ai_severity': sig.ai_severity,
            'reported_cases': sig.reported_cases,
            'reported_deaths': sig.reported_deaths,
            'created_at': created_at.isoformat(),
        }
        _, was_new = capture_snapshot(
            source_module='alerts', prediction_class='alert_cluster',
            country_iso=iso, country_name=sig.location_country or '',
            disease_name=disease, predicted_label=str(label),
            province=(sig.location_admin1 or ''), district=(sig.location_admin2 or ''),
            horizon_days=window_days, window_start=created_at, window_end=window_end,
            # The signal's confidence doubles as a calibratable probability.
            predicted_probability=(sig.confidence_score / 100.0
                                   if sig.confidence_score is not None else None),
            model_version=f"sentinel:{sig.ingestion_source or 'unknown'}",
            computed_at=created_at,
            raw_payload=payload, source_endpoint='sentinel.Signal',
        )
        snaps += int(was_new)

        # Analyst resolution = ground truth.
        if sig.status == 'validated':
            resolved_at = sig.validated_at or sig.triaged_at or now
            _, n = capture_outcome(
                outcome_type='live_feed_signal', source_feed='live_feed',
                country_iso=iso, disease_name=disease, occurred_at=resolved_at,
                province=(sig.location_admin1 or ''), district=(sig.location_admin2 or ''),
                observed_label='validated',
                observed_cases=sig.reported_cases, observed_deaths=sig.reported_deaths,
                evidence_url=(sig.source_url or ''),
                raw_payload={'signal_id': sig.id, 'resolution': 'validated',
                             'validated_at': resolved_at.isoformat()},
            )
            outcomes += int(n)
        # `dismissed` deliberately produces NO outcome: when the window closes
        # with no corroborating event, the MATCH stage records a False Alarm.

    return {'snapshots': snaps, 'outcomes': outcomes}


def collect_official_outcomes(window_days=120, signal_limit=None):
    """
    Derive authoritative ground-truth OutcomeEvents from PDX's own data, so
    prediction classes that need WHO-DON / outbreak-confirmed / cross-border
    evidence can be scored automatically instead of sitting Pending forever.

    Mapping (conservative, audit-friendly):
      * A *validated* Tier-1 signal (official: WHO / Ministry) → `who_don`
        outcome — an official source confirmed it.
      * A *validated* Tier-2 signal (verified media)           → `outbreak_confirmed`.
      * Any signal flagged `cross_border_risk`                  → `cross_border_import`
        outcome (the realised spillover the predictions module forecasts).

    Idempotent (dedup on payload fingerprint per outcome_type). Returns counts.
    """
    from sentinel.models import Signal
    now = timezone.now()
    since = now - timedelta(days=window_days)
    counts = {'who_don': 0, 'outbreak_confirmed': 0, 'cross_border_import': 0}

    qs = Signal.objects.filter(created_at__gte=since).order_by('-created_at')
    if signal_limit:
        qs = qs[:signal_limit]

    for sig in qs.iterator():
        iso = (sig.location_country_iso or '').strip()
        disease = (sig.disease_name or '').strip()
        occurred = sig.validated_at or sig.source_timestamp or sig.created_at or now
        base_payload = {
            'signal_id': sig.id, 'source_name': sig.source_name,
            'source_tier': sig.source_tier, 'source_url': sig.source_url,
            'status': sig.status, 'priority': sig.priority,
        }

        # Official / media confirmation from validated signals.
        if sig.status == 'validated':
            if sig.source_tier == 1:
                otype = 'who_don'
            elif sig.source_tier == 2:
                otype = 'outbreak_confirmed'
            else:
                otype = None
            if otype:
                _, n = capture_outcome(
                    outcome_type=otype, source_feed='who_don' if otype == 'who_don' else 'hdis',
                    country_iso=iso, disease_name=disease, occurred_at=occurred,
                    province=(sig.location_admin1 or ''), district=(sig.location_admin2 or ''),
                    observed_cases=sig.reported_cases, observed_deaths=sig.reported_deaths,
                    evidence_url=(sig.source_url or ''),
                    raw_payload=dict(base_payload, derived_outcome=otype),
                )
                counts[otype] += int(n)

        # Cross-border importation events (realised spillover).
        if sig.cross_border_risk:
            _, n = capture_outcome(
                outcome_type='cross_border_import', source_feed='live_feed',
                country_iso=iso, disease_name=disease, occurred_at=occurred,
                province=(sig.location_admin1 or ''),
                evidence_url=(sig.source_url or ''),
                raw_payload=dict(base_payload, derived_outcome='cross_border_import'),
            )
            counts['cross_border_import'] += int(n)

    return counts


# ─────────────────────────────────────────────────────────────────────
# Over-HTTP collectors (detached-service mode)
# ─────────────────────────────────────────────────────────────────────

class PDXClient:
    """
    Thin authenticated client for datarepr.duckdns.org/api/v1. Uses the
    service JWT (Bearer) exactly as PDX's CustomTokenAuthentication expects.
    Network access is the deployer's responsibility; this class only shapes
    the requests.
    """

    def __init__(self, base_url, token, timeout=30):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout

    def get(self, path, params=None):
        import requests
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = requests.get(
            url, params=params, timeout=self.timeout,
            headers={'Authorization': f'Bearer {self.token}'},
        )
        resp.raise_for_status()
        return resp.json()


def ingest_outbreak_events(events: list, outbreak_id=1):
    """
    Persist Ebola Outbreak Workspace events to the append-only EbolaEvent log
    (from /events/?limit=200 polling or the SSE stream). Idempotent on
    event_uid. Also emits HCW / unsafe-burial / silence events as OutcomeEvents
    so they can serve as ground truth for classes #9/#10/#11.

    PAYLOAD SHAPE — IMPORTANT: the Outbreak Workspace SSE/event endpoints are
    part of the v2.0 dev change brief and are NOT in the current backend repo,
    so the field names below (`id`/`uid`, `kind`, `timestamp`, `country_iso`,
    `province`, `severity`, `summary`, `citations`) are read defensively with
    fallbacks against the *documented* shape. Once the real endpoint exists,
    confirm one sample payload and adjust the `.get(...)` keys here if they
    differ. Unknown event kinds fall through to 'other' rather than failing.
    """
    kind_to_outcome = {
        'hcw': ('hcw_infection', 'hcw_infection'),
        'burial': ('unsafe_burial', 'unsafe_burial'),
        'silence': ('dhis2_gap', 'silence_detection'),
    }
    created_events = created_outcomes = 0
    for ev in events:
        uid = str(ev.get('id') or ev.get('uid') or ev.get('event_uid') or '')
        if not uid or EbolaEvent.objects.filter(event_uid=uid).exists():
            continue
        iso = ev.get('country_iso', '') or ev.get('iso3', '')
        occurred = _dt(ev.get('timestamp') or ev.get('occurred_at'), timezone.now())
        kind = ev.get('kind') or ev.get('event_kind') or 'other'
        EbolaEvent.objects.create(
            outbreak_id=outbreak_id,
            event_uid=uid,
            event_kind=kind if kind in dict(EbolaEvent.EVENT_KINDS) else 'other',
            country_iso=iso,
            province=ev.get('province', ''),
            district=ev.get('district', ''),
            severity=str(ev.get('severity', '')),
            summary=ev.get('summary', '') or ev.get('message', ''),
            citations=ev.get('citations', []),
            raw_event=ev,
            occurred_at=occurred,
            tenant=tenant_for_iso(iso),
        )
        created_events += 1

        if kind in kind_to_outcome:
            outcome_type, _ = kind_to_outcome[kind]
            _, n = capture_outcome(
                outcome_type=outcome_type, source_feed='outbreak_events',
                country_iso=iso, disease_name='ebola', occurred_at=occurred,
                province=ev.get('province', ''), district=ev.get('district', ''),
                raw_payload=ev, evidence_url=ev.get('url', ''),
            )
            created_outcomes += int(n)
    return {'events': created_events, 'outcomes': created_outcomes}


def collect_pdx_outbreak_events(lookback_days=30):
    """
    Bridge: pull from PDX's local `outbreak.OutbreakEvent` table into the
    verification EbolaEvent log. Idempotent on event_uid.
    """
    from outbreak.models import OutbreakEvent
    cutoff = timezone.now() - timedelta(days=lookback_days)
    qs = OutbreakEvent.objects.filter(ts__gte=cutoff).select_related('outbreak').iterator()

    events = []
    for e in qs:
        regions = (getattr(e.outbreak, 'regions', None) or [])
        iso = ''
        if isinstance(regions, list) and regions:
            iso = str(regions[0])[:3].upper()
        iso = iso or (e.payload_json or {}).get('country_iso', '')
        events.append({
            'id': f'outbreak:{e.id}',
            'kind': e.kind,
            'timestamp': e.ts.isoformat() if e.ts else None,
            'country_iso': iso,
            'province': (e.payload_json or {}).get('province', ''),
            'district': e.geo or '',
            'severity': str((e.payload_json or {}).get('severity', '')),
            'summary': (e.payload_json or {}).get('summary', '') or (e.payload_json or {}).get('message', ''),
            'citations': (e.payload_json or {}).get('citations', []),
            'url': e.source_ref or '',
        })

    if not events:
        return {'events': 0, 'outcomes': 0}
    return ingest_outbreak_events(events, outbreak_id=1)


def ingest_adaptor_health(adaptor_health: dict, outbreak_id=1):
    """
    Record per-adaptor freshness from /adaptor-health/ (Change Brief §1).
    Flags adaptors stale beyond 2× cadence; records the four known-dark
    adaptors (mobility, deforestation, climate, unsafe_burial) as KNOWN_GAP.
    """
    known_dark = {'mobility', 'deforestation', 'climate', 'unsafe_burial'}
    now = timezone.now()
    written = 0
    for adaptor, info in (adaptor_health or {}).items():
        cadence = info.get('expected_cadence_hours')
        last_seen = _dt(info.get('last_seen_at'))
        staleness = None
        if last_seen:
            staleness = (now - last_seen).total_seconds() / 3600.0
        if adaptor in known_dark and not last_seen:
            status = SourceAudit.STATUS_KNOWN_GAP
        elif last_seen is None:
            status = SourceAudit.STATUS_MISSING
        elif cadence and staleness and staleness > 2 * cadence:
            status = SourceAudit.STATUS_STALE
        else:
            status = SourceAudit.STATUS_LIVE
        SourceAudit.objects.create(
            adaptor=adaptor if adaptor in dict(SourceAudit.ADAPTORS) else 'sentinel_signal',
            outbreak_id=outbreak_id, status=status,
            expected_cadence_hours=cadence, last_seen_at=last_seen,
            staleness_hours=staleness,
            note=info.get('note', '')[:255],
        )
        written += 1
    return written
