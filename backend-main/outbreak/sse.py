"""
Server-Sent Events ring buffer + dispatcher (T-025).

Process-local: every running Django/ASGI worker keeps its own buffer.
A post_save signal on OutbreakEvent (registered in apps.py) pushes new
event payloads onto the buffer, which the stream view drains via a
queue per subscriber.
"""

import json
import queue
import threading
import time
from collections import deque
from typing import Iterable

from django.dispatch import receiver
from django.db.models.signals import post_save


MAX_RECENT = 100  # ring buffer size — recent events served to new subscribers

_lock = threading.RLock()
_recent: deque = deque(maxlen=MAX_RECENT)
_subscribers: dict = {}  # outbreak_id -> set[queue.Queue]


def _serialize(event) -> dict:
    return {
        'id': event.id,
        'outbreak_id': event.outbreak_id,
        'ts': event.ts.isoformat() if hasattr(event.ts, 'isoformat') else str(event.ts),
        'kind': event.kind,
        'source': event.source,
        'geo': event.geo,
        'payload_json': event.payload_json,
        'confidence': str(event.confidence),
    }


def publish(event) -> None:
    """Broadcast an event to all subscribers for its outbreak."""
    payload = _serialize(event)
    with _lock:
        _recent.append(payload)
        subs = list(_subscribers.get(event.outbreak_id, ()))
    for q in subs:
        try:
            q.put_nowait(payload)
        except queue.Full:
            pass  # subscriber too slow; drop this event for them


def subscribe(outbreak_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=500)
    with _lock:
        _subscribers.setdefault(outbreak_id, set()).add(q)
        # Replay recent events for this outbreak so subscriber doesn't miss
        for ev in list(_recent):
            if ev.get('outbreak_id') == outbreak_id:
                try:
                    q.put_nowait(ev)
                except queue.Full:
                    break
    return q


def unsubscribe(outbreak_id: int, q: queue.Queue) -> None:
    with _lock:
        subs = _subscribers.get(outbreak_id)
        if subs and q in subs:
            subs.discard(q)
            if not subs:
                _subscribers.pop(outbreak_id, None)


def event_stream(outbreak_id: int, *, heartbeat_seconds: int = 15) -> Iterable[bytes]:
    """
    Generator: yields SSE-formatted bytes. Intended for use as a
    StreamingHttpResponse iterator.
    """
    q = subscribe(outbreak_id)
    try:
        yield b'retry: 5000\n\n'
        last_beat = time.monotonic()
        while True:
            try:
                payload = q.get(timeout=heartbeat_seconds)
                yield ('data: ' + json.dumps(payload) + '\n\n').encode('utf-8')
            except queue.Empty:
                # send heartbeat
                if time.monotonic() - last_beat >= heartbeat_seconds:
                    yield b': heartbeat\n\n'
                    last_beat = time.monotonic()
    except (GeneratorExit, BrokenPipeError):
        return
    finally:
        unsubscribe(outbreak_id, q)


# ── Signal wiring ───────────────────────────────────────────────────────


_signal_connected = False


def install_signal_handlers():
    """Idempotent — call once from AppConfig.ready()."""
    global _signal_connected
    if _signal_connected:
        return
    from outbreak.models import OutbreakEvent

    @receiver(post_save, sender=OutbreakEvent, weak=False)
    def _on_event_created(sender, instance, created, **kwargs):
        if not created:
            return
        try:
            publish(instance)
        except Exception:  # noqa: BLE001 — best-effort SSE publish: must never break the post_save handler
            import logging
            logging.getLogger(__name__).exception("SSE publish failed for event %s", instance.id)
        # Also evaluate notification rules for the event.
        try:
            from outbreak.notifications.rule_engine import evaluate_event
            evaluate_event(instance)
        except Exception:  # noqa: BLE001 — best-effort rule eval: must never break the post_save handler
            import logging
            logging.getLogger(__name__).exception("notification eval failed for event %s", instance.id)

    _signal_connected = True
