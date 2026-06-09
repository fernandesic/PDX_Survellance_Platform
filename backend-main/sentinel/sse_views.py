"""
Server-Sent Events stream for Tier 0 (CHW Ground Truth) signals.

The frontend opens an ``EventSource('/api/v1/sentinel/signals/stream/tier0/')``
once per page; each new Kobo submission published via ``sentinel.realtime``
arrives here within ~50ms.

This view holds the gunicorn thread for the lifetime of the connection.
With ``--worker-class gthread --threads 4`` that gives us 4 concurrent
streams per gunicorn worker — fine for the AFRO team. If we need more
concurrency later, bump ``--threads`` or add workers.
"""

import json
import logging
import time

import redis
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from sentinel.realtime import CHANNEL_TIER0

logger = logging.getLogger(__name__)


# Send a keep-alive comment line every N seconds so intermediate proxies
# (nginx, cloud load balancers) don't drop the idle connection.
KEEPALIVE_SECONDS = 20


def _stream_tier0():
    """Generator that yields SSE-formatted bytes from the Redis channel."""
    url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0")
    client = redis.from_url(url)
    pubsub = client.pubsub(ignore_subscribe_messages=True)
    pubsub.subscribe(CHANNEL_TIER0)

    # Initial "hello" so the browser knows the stream is alive.
    yield b": connected\n\n"
    yield f"event: ready\ndata: {{}}\n\n".encode("utf-8")

    last_keepalive = time.time()
    try:
        while True:
            # Block up to 1s waiting for a message; if none, emit keepalive
            # when the interval expires so connection stays warm.
            message = pubsub.get_message(timeout=1.0)
            if message and message.get("type") == "message":
                data = message.get("data")
                if isinstance(data, bytes):
                    data = data.decode("utf-8", errors="replace")
                # Parse to extract event name; fall back to generic signal.
                try:
                    parsed = json.loads(data) if isinstance(data, str) else {}
                    event_name = parsed.get("event", "signal")
                except (json.JSONDecodeError, AttributeError, TypeError):
                    event_name = "signal"
                yield f"event: {event_name}\ndata: {data}\n\n".encode("utf-8")
                last_keepalive = time.time()
            elif time.time() - last_keepalive >= KEEPALIVE_SECONDS:
                yield b": keepalive\n\n"
                last_keepalive = time.time()
    except GeneratorExit:
        # Browser closed the EventSource — clean up Redis subscription.
        logger.debug("sse: client disconnected from %s", CHANNEL_TIER0)
    except (redis.exceptions.RedisError, ConnectionError, OSError) as exc:
        logger.warning("sse: stream loop error: %s", exc)
    finally:
        try:
            pubsub.close()
        except (redis.exceptions.RedisError, ConnectionError, OSError) as exc:
            logger.debug("sse: pubsub.close failed: %s", exc)


class Tier0SignalStreamView(APIView):
    """GET /api/v1/sentinel/signals/stream/tier0/

    Server-Sent Events feed of newly created Tier 0 signals (CHW ground truth).
    Opened by the CHW Live Field Intelligence panel and any other component
    that wants push updates instead of polling.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = StreamingHttpResponse(
            _stream_tier0(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        # Tell nginx to stream this response without buffering — without
        # this, nginx waits for the response to "finish" and the browser
        # never sees any events.
        response["X-Accel-Buffering"] = "no"
        # Disable any framework-level Connection: close
        response["Connection"] = "keep-alive"
        return response
