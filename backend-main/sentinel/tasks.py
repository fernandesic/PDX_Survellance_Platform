"""
AFRO Sentinel Watchtower - Celery Tasks
Background tasks for signal processing.

NOTE: AI triage (auto_triage_signal, batch_triage_new_signals) has been moved
to sentinel/agent_classifier.py which runs via APScheduler.
Stub ingestion tasks (ingest_from_gdelt, ingest_from_reliefweb) have been
removed — real implementations live in sentinel/ingestion.py.

All tasks use @with_tenant('0') to set app.current_tenant = '0'
(super-admin) on the PostgreSQL session.  Celery workers don't go
through TenantMiddleware, so without this the connection_created signal
leaves app.current_tenant at '-1' (deny-all), blocking all reads under RLS.
"""

import logging
from celery import shared_task
from django.db import DatabaseError
from django.utils import timezone

from sentinel.models import Signal, DiseaseKeyword, SourceCredibility, SignalPriority, SignalStatus
from sentinel.noise_filter import noise_filter
from sentinel.disease_detector import disease_detector
from utils.tenant_resolver import resolve_tenant
from utils.tenant_tasks import with_tenant

logger = logging.getLogger(__name__)


@shared_task
@with_tenant('0')
def process_raw_signal(raw_text: str, source_name: str, source_url: str = None, 
                       source_tier: int = 3, country_iso: str = None, 
                       raw_payload: dict = None) -> dict:
    """
    Process a raw signal through the ingestion pipeline.
    
    Steps:
    1. Apply noise filter
    2. Detect diseases
    3. Classify priority
    4. Create Signal record
    5. Trigger AI classification for P1/P2 signals (via agent_classifier)
    
    Returns dict with signal_id or rejection reason.
    """
    # Step 1: Apply noise filter
    filter_result = noise_filter.filter_signal(raw_text, country_iso)
    
    if not filter_result['pass']:
        logger.info(f"Signal rejected: {filter_result['reason']}")
        return {
            'accepted': False,
            'reason': filter_result['reason'],
            'score': filter_result['score']
        }
    
    # Step 2: Detect diseases
    disease_info = disease_detector.get_primary_disease(raw_text)
    
    # Step 3: Classify priority
    priority = disease_detector.classify_priority(raw_text)
    
    # Step 4: Create Signal record
    signal = Signal.objects.create(
        signal_type='disease' if disease_info else 'hazard',
        disease_name=disease_info['name'] if disease_info else None,
        disease_category=disease_info['category'] if disease_info else None,
        location_country=country_iso or 'Unknown',
        location_country_iso=country_iso,
        original_text=raw_text[:5000],  # Truncate if too long
        original_language=None,  # Could add language detection
        source_name=source_name,
        source_url=source_url,
        source_tier=source_tier,
        priority=priority,
        confidence_score=disease_info['confidence'] if disease_info else filter_result['score'],
        status=SignalStatus.NEW,
        ingestion_source='celery',
        raw_payload=raw_payload,
        tenant=resolve_tenant(iso=country_iso),
    )
    
    # Update source credibility stats
    try:
        source, created = SourceCredibility.objects.get_or_create(
            source_name=source_name,
            defaults={
                'source_type': 'media',
                'tier': source_tier
            }
        )
        source.total_signals += 1
        source.last_signal_at = timezone.now()
        source.save(update_fields=['total_signals', 'last_signal_at'])
    except (DatabaseError, AttributeError) as e:
        logger.warning(f"Could not update source credibility: {e}")
    
    logger.info(f"Signal created: ID={signal.id}, Priority={priority}, Disease={disease_info['name'] if disease_info else 'Unknown'}")
    
    # Step 5: Trigger AI classification for P1/P2 signals
    if priority in ['P1', 'P2']:
        try:
            from sentinel.agent_classifier import classify_single_signal
            classify_single_signal(signal)
        except Exception as e:  # noqa: BLE001 — best-effort classification hook: any failure must not block signal save
            logger.error(f"AI classification failed for signal {signal.id}: {e}")
    
    return {
        'accepted': True,
        'signal_id': signal.id,
        'priority': priority,
        'disease': disease_info['name'] if disease_info else None,
        'confidence': signal.confidence_score
    }
