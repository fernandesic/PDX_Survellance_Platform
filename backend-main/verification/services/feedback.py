"""
STAGE 4 — FEEDBACK
==================

The system acts on scores rather than just displaying them (Proposal §3):

  * open_review_tickets — auto-opens a ReviewTicket for every significant
    Miss / False Alarm whose window has just closed (success criterion #2:
    within 24h). Idempotent: one ticket per verdict.

  * compute_calibration — derives, per (module × disease), a confidence
    multiplier/offset from verified reliability that PDX modules can query to
    auto-adjust their outputs (success criterion #3).

A notification hook (Telegram/email, per the Executive Brief's HITL stack) is
left as a thin, swappable callable so wiring it to the real channel is a
one-liner and unit tests stay side-effect free.
"""

import logging
from collections import defaultdict

from django.utils import timezone

from verification.models import (
    MatchVerdict, ReviewTicket, CalibrationRecord,
)
from verification.services.tenancy import tenant_for_iso

logger = logging.getLogger(__name__)


def _notify(ticket: ReviewTicket):
    """Dispatch a newly-opened ticket to PDX's Telegram/email channels."""
    from verification.services import notifications
    logger.info('ReviewTicket opened: %s (%s)', ticket.title, ticket.reason)
    return notifications.notify_ticket(ticket)


def open_review_tickets(min_window_close=None):
    """
    Open tickets for MISS / FALSE_ALARM verdicts that don't already have one.
    Returns the list of created tickets.
    """
    flagged = (MatchVerdict.objects
               .select_related('snapshot')
               .filter(verdict__in=[MatchVerdict.VERDICT_MISS,
                                    MatchVerdict.VERDICT_FALSE_ALARM])
               .filter(tickets__isnull=True))
    if min_window_close:
        flagged = flagged.filter(snapshot__window_end__gte=min_window_close)

    created = []
    for v in flagged.iterator():
        s = v.snapshot
        reason = (ReviewTicket.REASON_MISS
                  if v.verdict == MatchVerdict.VERDICT_MISS
                  else ReviewTicket.REASON_FALSE_ALARM)
        label = 'Miss' if reason == ReviewTicket.REASON_MISS else 'False Alarm'
        title = (f"{label}: {s.get_source_module_display()} "
                 f"{s.country_iso} {s.disease_name or ''}".strip())
        ticket = ReviewTicket.objects.create(
            verdict=v,
            source_module=s.source_module,
            reason=reason,
            title=title,
            detail=(f"Prediction class: {s.get_prediction_class_display()}\n"
                    f"Predicted: {s.predicted_label or s.predicted_value or s.predicted_probability}\n"
                    f"Window: {s.window_start:%Y-%m-%d} → {s.window_end:%Y-%m-%d}\n"
                    f"Verdict evidence: {v.evidence_note}"),
            country_iso=s.country_iso,
            disease_name=s.disease_name,
            tenant=tenant_for_iso(s.country_iso),
        )
        _notify(ticket)
        created.append(ticket)
    return created


def compute_calibration(min_samples=20):
    """
    Build/refresh CalibrationRecords per (module × disease) from probability-
    class verdicts. Deactivates prior active records for each slice first.

    suggested_multiplier maps stated→observed: if a module's mean stated
    confidence is 0.9 but observed frequency is 0.6, multiplier ≈ 0.67.
    """
    verdicts = (MatchVerdict.objects
                .select_related('snapshot')
                .filter(verdict__in=[MatchVerdict.VERDICT_HIT,
                                     MatchVerdict.VERDICT_MISS,
                                     MatchVerdict.VERDICT_FALSE_ALARM])
                .filter(snapshot__prediction_class__in=['climate_confidence',
                                                        'spillover_probability']))

    slices = defaultdict(list)
    for v in verdicts:
        s = v.snapshot
        d = v.match_detail or {}
        if d.get('p') is None or d.get('outcome') is None:
            continue
        slices[(s.source_module, s.disease_name)].append((d['p'], d['outcome']))

    written = []
    for (module, disease), pairs in slices.items():
        if len(pairs) < min_samples:
            continue
        stated_mean = sum(p for p, _ in pairs) / len(pairs)
        observed_freq = sum(o for _, o in pairs) / len(pairs)
        ece = _expected_calibration_error(pairs)
        multiplier = (observed_freq / stated_mean) if stated_mean else 1.0
        # Clamp to a sane band so a thin sample can't wildly rescale outputs.
        multiplier = max(0.5, min(1.5, multiplier))

        CalibrationRecord.objects.filter(
            source_module=module, disease_name=disease, is_active=True,
        ).update(is_active=False)

        rec = CalibrationRecord.objects.create(
            source_module=module,
            disease_name=disease,
            stated_confidence_mean=round(stated_mean, 4),
            observed_frequency=round(observed_freq, 4),
            calibration_error=round(ece, 4),
            suggested_multiplier=round(multiplier, 4),
            suggested_offset=round(observed_freq - stated_mean, 4),
            n_samples=len(pairs),
            reliability=_reliability(pairs),
            is_active=True,
        )
        written.append(rec)
    return written


def _expected_calibration_error(pairs, n_bins=10):
    bins = [[] for _ in range(n_bins)]
    for p, o in pairs:
        idx = min(int(p * n_bins), n_bins - 1)
        bins[idx].append((p, o))
    n = len(pairs)
    ece = 0.0
    for b in bins:
        if not b:
            continue
        conf = sum(p for p, _ in b) / len(b)
        acc = sum(o for _, o in b) / len(b)
        ece += (len(b) / n) * abs(conf - acc)
    return ece


def _reliability(pairs, n_bins=10):
    bins = [[] for _ in range(n_bins)]
    for p, o in pairs:
        idx = min(int(p * n_bins), n_bins - 1)
        bins[idx].append((p, o))
    out = []
    for i, b in enumerate(bins):
        if not b:
            continue
        out.append({
            'prob_bin': f"{i/n_bins:.1f}-{(i+1)/n_bins:.1f}",
            'predicted': round(sum(p for p, _ in b) / len(b), 4),
            'observed': round(sum(o for _, o in b) / len(b), 4),
            'n': len(b),
        })
    return out
