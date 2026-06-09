"""
SourceAdaptor — the adaptor pattern centerpiece.

Every external data source is wrapped in a SourceAdaptor subclass.
The base class handles:
  - Dedupe via (source, source_ref) unique constraint
  - Idempotent fetch: running twice with identical input creates rows once
  - Health checking before fetch

Concrete adaptors implement fetch() and is_healthy().

Per best-code-practice.md:
  - Adaptor inherits SourceAdaptor
  - Declares name (lowercase snake, unique) and kinds_emitted
  - fetch() is idempotent — running twice does not duplicate
  - fetch() emits dicts, never OutbreakEvent instances directly
  - is_healthy() returns False on auth failure, network down, or schema mismatch
"""

import logging
from typing import Iterable

from django.db import IntegrityError
from django.utils import timezone

from outbreak.models import Outbreak, OutbreakEvent

logger = logging.getLogger(__name__)


class SourceAdaptor:
    """
    Abstract base for all outbreak data source adaptors.

    Subclasses must set:
      - name: str — unique adaptor identifier, becomes OutbreakEvent.source
      - kinds_emitted: list[str] — subset of EventKind values

    Subclasses must implement:
      - fetch(outbreak) -> Iterable[dict]
      - is_healthy() -> bool (optional, defaults to True)
    """

    name: str = ''
    # Subclasses MUST override with their own list literal. Per-class lists
    # avoid the classic shared-mutable-default pitfall if a subclass ever
    # mutates the attribute instead of replacing it.
    kinds_emitted: list = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if 'kinds_emitted' not in cls.__dict__:
            cls.kinds_emitted = list(cls.kinds_emitted)

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        """
        Yield dicts in the shape of OutbreakEvent fields:
            {
                'ts': datetime,
                'kind': str,           # from EventKind
                'geo': str,            # district/admin identifier
                'payload_json': dict,
                'confidence': Decimal or float,
                'source_ref': str,     # unique ref for dedupe
            }

        The base class wraps each in get_or_create keyed on
        (source, source_ref). Re-runs are idempotent.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement fetch()"
        )

    def is_healthy(self) -> bool:
        """
        Return False if the source is unavailable (network down,
        auth failure, schema mismatch). Default: True.
        """
        return True

    def run(self, outbreak: Outbreak) -> dict:
        """
        Execute the adaptor: check health, fetch events, persist with dedupe.

        Returns a summary dict:
            {'adaptor': name, 'status': str, 'emitted': int, 'skipped': int, 'error': str|None}
        """
        if not self.name:
            raise ValueError(f"{self.__class__.__name__}.name must be set")

        result = {
            'adaptor': self.name,
            'status': 'ok',
            'emitted': 0,
            'skipped': 0,
            'error': None,
        }

        # Health check
        try:
            if not self.is_healthy():
                logger.warning("adaptor %s unhealthy, skipping", self.name)
                result['status'] = 'degraded'
                result['error'] = 'Health check failed'
                return result
        except Exception as e:  # noqa: BLE001 — adaptor framework: any health-check crash must be reported as 'dead', not raised
            logger.exception("adaptor %s health check crashed", self.name)
            result['status'] = 'dead'
            result['error'] = str(e)
            return result

        # Fetch and persist
        try:
            for event_dict in self.fetch(outbreak):
                created = self._persist_event(outbreak, event_dict)
                if created:
                    result['emitted'] += 1
                else:
                    result['skipped'] += 1
        except Exception as e:  # noqa: BLE001 — adaptor framework: any fetch crash must be reported as 'dead', not raised
            logger.exception("adaptor %s crashed during fetch", self.name)
            result['status'] = 'dead'
            result['error'] = str(e)

        logger.info(
            "adaptor_run",
            extra={
                'adaptor': self.name,
                'outbreak_id': outbreak.id,
                'emitted': result['emitted'],
                'skipped': result['skipped'],
                'status': result['status'],
            },
        )
        return result

    def _persist_event(self, outbreak: Outbreak, event_dict: dict) -> bool:
        """
        Persist a single event with dedupe on (source, source_ref).
        Returns True if a new row was created, False if it was a duplicate.

        Idempotency contract: every emitted event must carry a non-empty
        source_ref. Without one, re-runs would write the same event over
        and over (the unique constraint is conditional on source_ref != '').
        We synthesise a stable ref from (ts, kind, geo, payload) when the
        adaptor forgets, and log a warning — silently producing duplicates
        is worse than either failing or relying on a hash.
        """
        source_ref = (event_dict.get('source_ref') or '').strip()
        if not source_ref:
            import hashlib
            import json as _json
            seed = _json.dumps(
                {
                    'ts': str(event_dict.get('ts') or ''),
                    'kind': event_dict.get('kind', ''),
                    'geo': event_dict.get('geo', ''),
                    'payload': event_dict.get('payload_json', {}),
                },
                sort_keys=True,
                default=str,
            ).encode('utf-8')
            source_ref = f'auto:{hashlib.sha256(seed).hexdigest()[:32]}'
            logger.warning(
                "adaptor %s emitted event without source_ref; "
                "synthesised %s from payload to preserve dedupe",
                self.name, source_ref,
            )

        exists = OutbreakEvent.objects.filter(
            source=self.name,
            source_ref=source_ref,
        ).exists()
        if exists:
            return False

        # Build the event
        ts = event_dict.get('ts', timezone.now())
        kind = event_dict.get('kind', '')
        if kind not in self.kinds_emitted:
            logger.warning(
                "adaptor %s emitted kind=%s not in kinds_emitted=%s",
                self.name, kind, self.kinds_emitted,
            )

        try:
            OutbreakEvent.objects.create(
                outbreak=outbreak,
                ts=ts,
                source=self.name,
                kind=kind,
                geo=event_dict.get('geo', ''),
                payload_json=event_dict.get('payload_json', {}),
                confidence=event_dict.get('confidence', 1.00),
                source_ref=source_ref,
            )
            return True
        except IntegrityError:
            # Race condition: another process created it between
            # our exists() check and create(). That's fine — dedupe worked.
            return False
