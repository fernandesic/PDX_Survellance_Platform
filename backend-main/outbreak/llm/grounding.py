"""
Backend-side grounding context builder (T-122).

Assembles a compact, token-budgeted block for the 8b model from:
  1. Outbreak core
  2. Pathogen profile (R0, CFR, hosts, key warning)
  3. Capacity (composite, readiness, IHR bottlenecks, weakest CHW district, spillover, STAR)
  4. Last-24h top events (signals, burials, HCW, etc.)
  5. Recent stats summary

Returns a `BuiltGrounding` carrying both the prompt text and the
`CitationContext` the validator will check against.
"""

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Optional

from django.utils import timezone

from outbreak.llm.citation_validator import CitationContext, CAP_KEYS


# Top-level pathogen profile fields the LLM is allowed to cite via [path:KEY].
ALLOWED_PATH_FIELDS = {
    'r0_min', 'r0_max', 'cfr_min', 'cfr_max',
    'incubation_days_min', 'incubation_days_max',
    'transmission_modes', 'vaccine_available', 'antiviral_available',
    'natural_hosts', 'reservoir', 'trigger_env_conditions',
    'trigger_season_months', 'key_warning', 'strains',
    'response_protocols', 'spillover_score', 'priority',
    'llm_clinical_notes',
}


@dataclass
class BuiltGrounding:
    text: str
    citation_ctx: CitationContext
    event_ids: list = field(default_factory=list)
    pathogen_name: str = ''
    clinical_notes: list = field(default_factory=list)


def build_grounding(outbreak, *, max_events: int = 15) -> BuiltGrounding:
    """Compose the grounding block for the outbreak."""
    from outbreak.models import OutbreakEvent
    from outbreak.services.capacity import get_outbreak_capacity

    profile = outbreak.pathogen.profile_json or {}
    clinical_notes = profile.get('llm_clinical_notes') or []

    parts: list = []

    # 1. Outbreak core
    parts.append(
        f"OUTBREAK[id={outbreak.id}]: {outbreak.pathogen.name}"
        f" | iso3={outbreak.iso3}"
        f" | status={outbreak.status}"
        f" | severity={outbreak.severity}"
        f" | declared={outbreak.declared_at.date().isoformat()}"
    )

    # 2. Pathogen profile (cite-as [path:FIELD])
    pp = outbreak.pathogen
    parts.append(
        f"PATHOGEN: R0 [path:r0_min]={pp.r0_min}–[path:r0_max]={pp.r0_max}"
        f" | CFR [path:cfr_min]={pp.cfr_min}%–[path:cfr_max]={pp.cfr_max}%"
        f" | incubation [path:incubation_days_min]={pp.incubation_days_min}–[path:incubation_days_max]={pp.incubation_days_max}d"
        f" | vaccine [path:vaccine_available]={pp.vaccine_available}"
        f" | antiviral [path:antiviral_available]={pp.antiviral_available}"
    )
    if pp.transmission_modes:
        parts.append(
            f"PATHOGEN_TX [path:transmission_modes]: {', '.join(pp.transmission_modes)}"
        )
    natural_hosts = profile.get('natural_hosts') or []
    if natural_hosts:
        parts.append(
            f"PATHOGEN_HOSTS [path:natural_hosts]: {', '.join(natural_hosts)}"
        )
    reservoir = profile.get('reservoir')
    if reservoir:
        parts.append(f"PATHOGEN_RESERVOIR [path:reservoir]: {reservoir}")
    triggers = profile.get('trigger_env_conditions') or []
    if triggers:
        parts.append(
            f"PATHOGEN_TRIGGERS [path:trigger_env_conditions]: {', '.join(triggers)}"
        )
    key_warning = profile.get('key_warning')
    if key_warning:
        parts.append(f"PATHOGEN_KEY_WARNING [path:key_warning]: {key_warning}")

    # 3. Capacity (cite as [cap:KEY])
    used_cap_keys: list = []
    try:
        cap = get_outbreak_capacity(outbreak)
    except Exception:  # noqa: BLE001 — best-effort capacity overlay: empty dict is the documented fallback
        cap = {}

    composite = cap.get('composite') or {}
    if composite.get('data_available') and composite.get('score') is not None:
        parts.append(
            f"CAP_COMPOSITE [cap:composite]: score={composite['score']:.0f}/100"
            f" risk={composite.get('risk_level') or 'unknown'}"
        )
        used_cap_keys.append('composite')

    readiness = cap.get('readiness') or {}
    if readiness.get('data_available') and readiness.get('score') is not None:
        gaps = readiness.get('weakest') or []
        gap_str = '; '.join(f"{w['category']} {w['score']:.0f}" for w in gaps[:3])
        line = f"CAP_READINESS [cap:readiness]: {readiness['score']:.0f}/100"
        if gap_str:
            line += f" gaps=({gap_str})"
        parts.append(line)
        used_cap_keys.append('readiness')

    ihr = cap.get('ihr') or {}
    if ihr.get('data_available'):
        bottlenecks = [c for c in (ihr.get('components') or []) if c.get('below_50')]
        bottleneck_str = '; '.join(
            f"{c['code']} {c['label']} {c['value']}" for c in bottlenecks[:3]
        )
        line = f"CAP_IHR [cap:ihr]: overall={ihr.get('overall') or '?'}"
        if bottleneck_str:
            line += f" bottlenecks=({bottleneck_str})"
        parts.append(line)
        used_cap_keys.append('ihr')

    chw = cap.get('chw') or {}
    if chw.get('data_available'):
        worst = None
        for d in chw.get('districts') or []:
            if d.get('gap_flag'):
                if worst is None or (d.get('active_pct') or 0) < (worst.get('active_pct') or 0):
                    worst = d
        line = (
            f"CAP_CHW [cap:chw]: density={chw.get('density') or '?'} per10k"
            f" active={chw.get('active_pct') or '?'}%"
        )
        if worst:
            line += f" worst_district={worst.get('district')}({worst.get('active_pct'):.0f}% active)"
        parts.append(line)
        used_cap_keys.append('chw')

    spillover = cap.get('spillover') or {}
    if spillover.get('data_available') and spillover.get('score') is not None:
        parts.append(
            f"CAP_SPILLOVER [cap:spillover]: score={spillover['score']:.0f}"
            f" stage={spillover.get('stage_label') or spillover.get('stage') or '?'}"
        )
        used_cap_keys.append('spillover')

    star = cap.get('star') or {}
    if star.get('data_available') and star.get('score') is not None:
        parts.append(
            f"CAP_STAR [cap:star]: {star['score']:.0f}"
            f" hazard={star.get('hazard') or '?'}"
        )
        used_cap_keys.append('star')

    # 4. Recent stats summary + 5. last-24h top events
    now = timezone.now()
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)
    events_qs = OutbreakEvent.objects.filter(outbreak=outbreak)
    total = events_qs.count()
    last_24h = events_qs.filter(ts__gte=since_24h).count()
    last_7d = events_qs.filter(ts__gte=since_7d).count()
    parts.append(
        f"STATS: total={total} last_24h={last_24h} last_7d={last_7d}"
    )

    # Pick top N events biased to recency.
    event_ids: list = []
    recent = events_qs.order_by('-ts')[:max_events]
    for evt in recent:
        headline = _event_headline(evt)
        parts.append(
            f"EVT[{evt.id}] [evt:{evt.id}] {evt.kind} @ {evt.ts.date().isoformat()} {evt.geo or ''}: {headline}"
        )
        event_ids.append(evt.id)

    text = '\n'.join(parts)

    ctx = CitationContext.from_grounding(
        event_ids=event_ids,
        cap_keys=used_cap_keys,
        path_fields=ALLOWED_PATH_FIELDS,
    )

    return BuiltGrounding(
        text=text,
        citation_ctx=ctx,
        event_ids=event_ids,
        pathogen_name=pp.name,
        clinical_notes=list(clinical_notes),
    )


def _event_headline(evt) -> str:
    """Extract a short headline string from any event's payload."""
    p = evt.payload_json or {}
    for key in ('headline', 'title', 'summary', 'message', 'description'):
        v = p.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()[:160]
    # Fall back to a synthesized string
    parts: list = []
    for k, v in p.items():
        if isinstance(v, (str, int, float)) and v not in (None, ''):
            parts.append(f"{k}={v}")
        if len(parts) >= 4:
            break
    return ' '.join(parts) or f"{evt.source}"
