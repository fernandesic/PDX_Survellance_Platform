"""
Real-time Signal broadcast via Redis pub/sub.

Producers (e.g. kobo/ingestion.py) call ``publish_signal_event`` after
creating a Signal. The SSE view in ``sentinel.sse_views`` subscribes to
the channel and streams events to connected browsers.

Channels:
  * pdx:signals:tier0  — only Signals where source_tier == 0 (CHW ground truth)

A single channel keeps the wire format simple. Per-tier or per-country
channels can be added later without breaking the contract.
"""

import json
import logging
from typing import Any

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

CHANNEL_TIER0 = "pdx:signals:tier0"


def _redis_client() -> "redis.Redis | None":
    url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0")
    try:
        return redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
    except (redis.exceptions.RedisError, ValueError, ConnectionError) as exc:
        logger.warning("realtime: cannot build redis client (%s) — events will not stream", exc)
        return None


def publish_signal_event(signal, event: str = "signal.created") -> None:
    """Publish a Signal payload to Tier 0 subscribers. Best-effort, never raises."""
    if getattr(signal, "source_tier", None) != 0:
        return  # only Tier 0 (CHW ground truth) is streamed
    client = _redis_client()
    if client is None:
        return
    payload: dict[str, Any] = {
        "event": event,
        "id": signal.id,
        "disease_name": signal.disease_name,
        "location_country": signal.location_country,
        "location_country_iso": signal.location_country_iso,
        "location_admin1": signal.location_admin1,
        "location_locality": signal.location_locality,
        "location_lat": float(signal.location_lat) if signal.location_lat is not None else None,
        "location_lng": float(signal.location_lng) if signal.location_lng is not None else None,
        "priority": signal.priority,
        "reported_cases": signal.reported_cases,
        "reported_deaths": signal.reported_deaths,
        "source_name": signal.source_name,
        "source_tier": signal.source_tier,
        "source_timestamp": signal.source_timestamp.isoformat() if signal.source_timestamp else None,
        "created_at": signal.created_at.isoformat() if signal.created_at else None,
        "translated_text": signal.translated_text,
        "original_text": signal.original_text,
        "ai_severity": getattr(signal, "ai_severity", None),
        "ai_classification": getattr(signal, "ai_classification", None),
    }
    try:
        client.publish(CHANNEL_TIER0, json.dumps(payload, default=str))
    except (redis.exceptions.RedisError, ConnectionError, OSError, TypeError) as exc:
        logger.warning("realtime: publish failed (%s) — signal %s will only appear on next poll", exc, signal.id)
