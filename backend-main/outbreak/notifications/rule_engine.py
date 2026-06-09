"""
Notification rule engine (T-040/T-041/T-043/T-044).

For each new OutbreakEvent, evaluate active NotificationRules and queue a
matched OutbreakNotification. High-severity rules enter `pending_confirm`
and stay there until either a human clicks Send/Cancel from the UI or
the hold window expires (driven by `process_due_notifications`).

Telegram dispatch (T-042) is intentionally out of scope here — the
dispatcher delegates to channel handlers, and only an `email` handler
(log-only stub) is registered. Wire Telegram in later.
"""

import logging
from datetime import timedelta
from typing import Iterable, Optional

from django.utils import timezone

from outbreak.models import (
    NotificationRule,
    OutbreakEvent,
    OutbreakNotification,
    OutbreakSeverity,
)

logger = logging.getLogger(__name__)


SEVERITY_RANK = {
    OutbreakSeverity.LOW: 1,
    OutbreakSeverity.MODERATE: 2,
    OutbreakSeverity.HIGH: 3,
    OutbreakSeverity.CRITICAL: 4,
}


def _matches(rule: NotificationRule, event: OutbreakEvent) -> bool:
    if not rule.enabled:
        return False
    if rule.pathogen_id and rule.pathogen_id != event.outbreak.pathogen_id:
        return False
    if rule.region:
        wanted = rule.region.strip().upper()
        if wanted != event.outbreak.iso3.upper() and wanted.lower() not in (event.geo or '').lower():
            return False
    if rule.event_kinds and event.kind not in rule.event_kinds:
        return False
    # Severity threshold compares the OUTBREAK severity, not the event.
    rank_required = SEVERITY_RANK.get(rule.severity_threshold, 0)
    rank_actual = SEVERITY_RANK.get(event.outbreak.severity, 0)
    if rank_actual < rank_required:
        return False
    return True


def _render_message(rule: NotificationRule, event: OutbreakEvent) -> str:
    headline = (event.payload_json or {}).get('headline') or ''
    return (
        f"[{event.outbreak.pathogen.name}] {event.kind} in {event.geo or event.outbreak.iso3}: "
        f"{headline[:200]} (event id {event.id})"
    )


def evaluate_event(event: OutbreakEvent) -> list:
    """Match `event` against all enabled rules. Returns queued notifications."""
    queued: list = []
    rules = NotificationRule.objects.filter(enabled=True)
    for rule in rules:
        if not _matches(rule, event):
            continue
        notif = _queue(rule, event)
        if notif is not None:
            queued.append(notif)
    return queued


def _queue(rule: NotificationRule, event: OutbreakEvent) -> Optional[OutbreakNotification]:
    """Create a single OutbreakNotification row in the right initial state."""
    severity = event.outbreak.severity
    is_high = SEVERITY_RANK.get(severity, 0) >= SEVERITY_RANK[OutbreakSeverity.HIGH]
    if is_high:
        # hold_seconds=0 is a valid "no hold" configuration. Trust the model's
        # PositiveIntegerField default (set on NotificationRule) — only fall
        # back to a safe value if the column is actually NULL.
        hs = rule.hold_seconds if rule.hold_seconds is not None else 60
        hold_until = timezone.now() + timedelta(seconds=max(0, hs))
        state = OutbreakNotification.State.PENDING_CONFIRM
    else:
        hold_until = None
        state = OutbreakNotification.State.PENDING

    try:
        notif = OutbreakNotification.objects.create(
            outbreak=event.outbreak,
            rule=rule,
            event=event,
            state=state,
            channel=rule.channel,
            rendered_message=_render_message(rule, event),
            hold_until=hold_until,
        )
        logger.info(
            "[outbreak.notify] queued notification %s for event %s via %s (%s)",
            notif.id, event.id, rule.channel, state,
        )
        return notif
    except Exception:  # noqa: BLE001 — queueing notification: failure must return None so the post_save handler survives
        logger.exception("[outbreak.notify] failed to queue notification for event %s", event.id)
        return None


def process_due_notifications() -> dict:
    """
    Drive every pending notification one step:
      - PENDING                  -> dispatch immediately
      - PENDING_CONFIRM (expired) -> if auto_send_after_hold dispatch, else stay
    Returns a summary counter.
    """
    summary = {'dispatched': 0, 'expired': 0, 'failed': 0, 'awaiting': 0}
    now = timezone.now()

    pending = OutbreakNotification.objects.filter(state=OutbreakNotification.State.PENDING)
    for notif in pending:
        if _dispatch(notif):
            summary['dispatched'] += 1
        else:
            summary['failed'] += 1

    awaiting = OutbreakNotification.objects.filter(
        state=OutbreakNotification.State.PENDING_CONFIRM,
    )
    for notif in awaiting:
        if notif.hold_until and notif.hold_until <= now:
            if notif.rule.auto_send_after_hold:
                if _dispatch(notif):
                    summary['dispatched'] += 1
                else:
                    summary['failed'] += 1
            else:
                # Transition expired-no-auto-send rows to DISMISSED so the
                # next sweep doesn't keep reprocessing them.
                notif.state = OutbreakNotification.State.DISMISSED
                notif.error = 'expired_no_auto_send'
                notif.save()
                summary['expired'] += 1
        else:
            summary['awaiting'] += 1

    return summary


def _dispatch(notif: OutbreakNotification) -> bool:
    """
    Send the notification through its channel handler. On success the row
    transitions to SENT, otherwise FAILED with the error text.
    """
    try:
        handler = CHANNEL_HANDLERS.get(notif.channel, _handle_log_only)
        handler(notif)
        notif.state = OutbreakNotification.State.SENT
        notif.dispatched_at = timezone.now()
        notif.save()
        return True
    except Exception as e:  # noqa: BLE001 — dispatch wrapper: must mark notif FAILED regardless of channel-specific error
        logger.exception("[outbreak.notify] dispatch failed for notif %s", notif.id)
        notif.state = OutbreakNotification.State.FAILED
        notif.error = str(e)[:500]
        notif.save()
        return False


# ── Channel handlers ────────────────────────────────────────────────────


def _handle_email(notif: OutbreakNotification) -> None:
    """
    Stub: email delivery is logged only. Wire SES/Django mail later if a
    user/recipient list materialises. Intentionally no Telegram here.
    """
    logger.info(
        "[outbreak.notify:email] would send to %s: %s",
        notif.rule.contact_ids, notif.rendered_message,
    )


def _handle_log_only(notif: OutbreakNotification) -> None:
    logger.info(
        "[outbreak.notify:%s] %s", notif.channel, notif.rendered_message,
    )


CHANNEL_HANDLERS = {
    'email': _handle_email,
    # Telegram intentionally not wired here (T-042 deferred).
    'telegram': _handle_log_only,
}
# Any channel not in CHANNEL_HANDLERS falls through to `_handle_log_only`
# in `_dispatch()` so an unknown channel never raises — it just logs.


def confirm(notif_id: int, *, send: bool, actor: str = '') -> Optional[OutbreakNotification]:
    """Human confirms or cancels a pending_confirm notification."""
    notif = OutbreakNotification.objects.filter(id=notif_id).first()
    if notif is None:
        return None
    if notif.state != OutbreakNotification.State.PENDING_CONFIRM:
        return notif
    if send:
        _dispatch(notif)
    else:
        notif.state = OutbreakNotification.State.DISMISSED
        notif.error = f"dismissed by {actor or 'user'}"
        notif.save()
    return notif


def evaluate_existing_events(outbreak, *, since=None) -> int:
    """Backfill helper — match existing events to current rules."""
    qs = OutbreakEvent.objects.filter(outbreak=outbreak)
    if since:
        qs = qs.filter(ts__gte=since)
    n = 0
    for evt in qs.order_by('-ts')[:200]:
        for _ in evaluate_event(evt):
            n += 1
    return n


# ── Iterable convenience ────────────────────────────────────────────────


def evaluate_events(events: Iterable[OutbreakEvent]) -> int:
    n = 0
    for evt in events:
        for _ in evaluate_event(evt):
            n += 1
    return n
