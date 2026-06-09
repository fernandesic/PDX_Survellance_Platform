"""
KoboToolbox Webhook Receiver

Receives POST payloads from KoboToolbox REST Services (webhooks).
Secured by secret URL token — wrong secret returns 404 (not 403).

Security:
  - CSRF exempt (external webhook, no browser session)
  - No Django auth required (public endpoint, secured by URL secret)
  - Validates _xform_id_string matches KOBO_ASSET_ID
  - Rate limited: 30 requests/minute per IP
  - Always returns 2xx (even on error — Kobo retries aggressively on non-2xx)
"""

import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from kobo.ingestion import process_webhook_payload
from utils.tenant_tasks import tenant_context

logger = logging.getLogger(__name__)


class KoboWebhookThrottle(AnonRateThrottle):
    """Rate limit for the Kobo webhook endpoint: 30 requests/minute per IP."""
    rate = '30/min'
    scope = 'kobo_webhook'


@method_decorator(csrf_exempt, name='dispatch')
class KoboWebhookView(APIView):
    """
    Receive a single submission payload from KoboToolbox REST Service.

    URL: /api/v1/kobo/webhook/<secret>/
    Method: POST
    Auth: None (secured by secret URL token)
    """
    authentication_classes = []  # No auth — public webhook
    permission_classes = [AllowAny]
    throttle_classes = [KoboWebhookThrottle]

    def post(self, request, secret: str) -> Response:
        # ── Validate webhook secret ─────────────────────────────────
        expected_secret = getattr(settings, 'KOBO_WEBHOOK_SECRET', '')
        if not expected_secret or secret != expected_secret:
            # Return 404 (not 403) to avoid leaking endpoint existence
            return Response(status=status.HTTP_404_NOT_FOUND)

        payload = request.data
        if not isinstance(payload, dict):
            logger.warning("Kobo webhook: payload is not a dict, ignoring")
            return Response(
                {'status': 'error', 'detail': 'Invalid payload format'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate form identity ──────────────────────────────────
        xform_id = payload.get('_xform_id_string', '')
        expected_asset_id = getattr(
            settings, 'KOBO_ASSET_ID', 'aLHVQjZHtA2G8uNW4HxHPh'
        )
        if xform_id != expected_asset_id:
            logger.warning(
                "Kobo webhook: rejected submission with _xform_id_string=%s "
                "(expected %s)",
                xform_id, expected_asset_id,
            )
            return Response(
                {'status': 'rejected', 'detail': 'Unknown form ID'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate required fields ────────────────────────────────
        kobo_id = payload.get('_id')
        if kobo_id is None:
            logger.warning("Kobo webhook: missing _id field")
            return Response(
                {'status': 'error', 'detail': 'Missing _id field'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Process the submission ──────────────────────────────────
        # Webhook runs outside Django middleware — no tenant context is set.
        # Wrap in tenant_context('0') so RLS allows both creating new
        # Signals and reading existing FK links on re-delivery.
        try:
            with tenant_context('0'):
                submission = process_webhook_payload(payload)

                # Determine if this was newly created or already existed
                if submission.signal:
                    return Response(
                        {'status': 'created', 'kobo_id': submission.kobo_id},
                        status=status.HTTP_201_CREATED,
                    )
                else:
                    # Submission existed already (re-delivery) — still 200
                    return Response(
                        {'status': 'accepted', 'kobo_id': submission.kobo_id},
                        status=status.HTTP_200_OK,
                    )

        except Exception as exc:  # noqa: BLE001 — Kobo webhook must ALWAYS return 2xx; their retry policy is aggressive
            # ALWAYS return 2xx — Kobo retries aggressively on non-2xx.
            # Log the error; the poll sync will pick it up.
            logger.exception(
                "Kobo webhook: processing failed for _id=%s: %s",
                kobo_id, exc,
            )
            return Response(
                {'status': 'accepted_with_error'},
                status=status.HTTP_200_OK,
            )
