"""
Telegram webhook view.

Telegram POSTs every chat update to /api/v1/sentinel/telegram-webhook/<secret>/.
The <secret> path segment is checked against TELEGRAM_WEBHOOK_SECRET so only
Telegram can hit this endpoint. Always responds 200 (Telegram retries on
non-200 and we don't want loops).
"""

import logging
import os

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from sentinel.telegram_bot import handle_update_json

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def telegram_webhook(request, secret: str):
    expected = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip()
    if not expected or secret != expected:
        logger.warning('telegram_webhook: bad secret from %s', request.META.get('REMOTE_ADDR'))
        return HttpResponse(status=403)

    try:
        handle_update_json(request.body)
    except Exception as e:  # noqa: BLE001 — Telegram webhook must ALWAYS return 200; their retry policy is aggressive
        logger.exception('telegram_webhook: handler crashed: %s', e)

    return HttpResponse(status=200)
