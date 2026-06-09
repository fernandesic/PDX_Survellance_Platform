"""
HDIS Briefing Intelligence Engine
4-agent pipeline: Gatherer → Analyst → Verifier → Composer

Design: Each agent has a single responsibility.
- Gatherer:  Pure DB queries — assembles context bundle (no LLM)
- Analyst:   LLM-powered cross-pillar reasoning → structured JSON
- Verifier:  Deterministic trust checks + LLM contradiction detection
- Composer:  LLM-powered prose writer → final briefing content

Usage:
    from hdis.briefing_engine import generate_briefing
    briefing = generate_briefing(scope='daily_global')
    briefing = generate_briefing(scope='country_focus', country_iso='NGA')
"""

import json
import logging
import time
from datetime import timedelta
from typing import Any, Dict, List, Optional

from django.db.models import Count, Q
from django.utils import timezone

from sentinel.models import Signal
from utils.tenant_resolver import resolve_tenant
from hdis.models import (
    Alert, Briefing, TrustScore,
    BriefingScope, BriefingStatus, ConfidenceLevel,
)
from hdis.llm_client import chat, chat_json, LLMConfig

logger = logging.getLogger(__name__)

# Canonical set of all HDIS health pillars — single source of truth.
# Used by Gatherer (exclusion logic) and data-driven briefing (gap detection).
HDIS_PILLARS = {
    'outbreak', 'policy', 'funding', 'vaccine', 'conflict',
    'climate', 'agreement', 'workforce', 'uhc', 'governance',
}


# ============================================================================
# TOKEN BUDGET MANAGEMENT
# ============================================================================

# Approximate context window sizes for common models (in tokens).
# Override with LLM_CONTEXT_WINDOW env var if your model isn't listed.
CONTEXT_WINDOWS = {
    # Ollama models
    'llama3.2:1b': 8_192,
    'llama3.1': 131_072,
    'llama3': 8_192,
    'mistral': 32_768,
    'mixtral': 32_768,
    'phi3': 128_000,
    'gemma2': 8_192,
    'qwen2.5': 32_768,
    # OpenAI
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'gpt-4-turbo': 128_000,
    'gpt-4': 8_192,
    'gpt-3.5-turbo': 16_385,
    # Gemini
    'gemini-pro': 32_768,
    'gemini-1.5-pro': 1_048_576,
    'gemini-1.5-flash': 1_048_576,
    # Azure deployments (matched by deployment name)
    'gpt-4o-deployment': 128_000,
}


def estimate_tokens(text: str) -> int:
    """
    Rough token estimation: ~1 token per 4 characters for English text.
    This is intentionally conservative (over-estimates) to leave headroom.
    """
    return max(1, len(text) // 4)


def get_context_window() -> int:
    """
    Get the context window size for the current LLM model.

    Priority:
        1. LLM_CONTEXT_WINDOW env var (explicit override)
        2. Known model lookup from CONTEXT_WINDOWS
        3. Default: 8192 (conservative fallback)
    """
    import os
    env_val = os.getenv('LLM_CONTEXT_WINDOW')
    if env_val:
        return int(env_val)

    model = os.getenv('LLM_MODEL', 'llama3.2:1b')
    # Exact match first, then try prefix matching
    if model in CONTEXT_WINDOWS:
        return CONTEXT_WINDOWS[model]
    for known, window in CONTEXT_WINDOWS.items():
        if model.startswith(known):
            return window

    logger.warning(
        "[TokenBudget] Unknown model '%s' — defaulting to 8192 tokens. "
        "Set LLM_CONTEXT_WINDOW env var to override.",
        model,
    )
    return 8_192


def _compute_budget(system_prompt: str, max_response_tokens: int) -> int:
    """
    Compute the available token budget for the user prompt,
    given the system prompt and expected response size.

    Returns the number of tokens available for the user prompt.
    """
    context_window = get_context_window()
    system_tokens = estimate_tokens(system_prompt)
    # Reserve tokens for: system prompt + response + safety margin (5%)
    safety_margin = max(100, int(context_window * 0.05))
    available = context_window - system_tokens - max_response_tokens - safety_margin
    return max(500, available)  # Floor: never go below 500 tokens


# ============================================================================
# AGENT 1: GATHERER — Pure DB queries, no LLM
# ============================================================================

def _gather_context(
    scope: str,
    country_iso: Optional[str] = None,
    hours_back: int = 48,
    exclude_pillars: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Assemble a focused, curated context bundle from the database.
    No LLM involved — deterministic queries only.

    Args:
        exclude_pillars: List of pillar names to exclude (e.g. ['outbreak']).
                         Signals with these pillars are filtered out entirely.

    Returns a structured dict with everything the Analyst needs.
    """
    start = time.monotonic()
    now = timezone.now()
    cutoff = now - timedelta(hours=hours_back)

    # ── Base queryset ────────────────────────────────────────────────
    base_qs = Signal.objects.select_related('trust').filter(
        created_at__gte=cutoff,
        status__in=['new', 'under_review', 'verified'],
    )
    if country_iso:
        base_qs = base_qs.filter(location_country_iso=country_iso)
    if exclude_pillars:
        # Hybrid exclusion: exclude signals whose primary pillar is in
        # exclude_pillars UNLESS they have secondary_pillars that overlap
        # with non-excluded HDIS-relevant pillars.
        #
        # Example: A cholera signal (pillar='outbreak') with
        # secondary_pillars=['agreement'] is KEPT because it has
        # cross-pillar relevance to health diplomacy.
        #
        # All known HDIS pillars (for secondary overlap detection):
        all_hdis_pillars = HDIS_PILLARS
        # Secondary pillars that would justify keeping an excluded signal
        keep_pillars = all_hdis_pillars - set(exclude_pillars)

        if keep_pillars:
            # Build Q: keep if NOT excluded OR has relevant secondary pillar
            secondary_q = Q()
            for p in keep_pillars:
                secondary_q |= Q(secondary_pillars__contains=[p])

            base_qs = base_qs.filter(
                ~Q(pillar__in=exclude_pillars) | secondary_q
            )
        else:
            # All pillars excluded (unusual) — fall back to simple exclude
            base_qs = base_qs.exclude(pillar__in=exclude_pillars)

    # ── Recent signals grouped by pillar ─────────────────────────────
    signals = list(
        base_qs.order_by('-created_at').values(
            'id', 'original_text', 'disease_name', 'pillar',
            'location_country', 'location_country_iso',
            'source_name', 'source_tier', 'priority',
            'confidence_score', 'created_at',
            'trust__score', 'trust__trust_level',
        )[:50]  # Cap to prevent context window overload (optimized for local LLM)
    )

    # Group by pillar
    pillars: Dict[str, List[Dict]] = {}
    for s in signals:
        pillar = s.get('pillar', 'outbreak')
        pillars.setdefault(pillar, []).append(s)

    # ── Historical context (same country + disease, last 90d) ────────
    history_signals = []
    if country_iso:
        # Find active disease in recent signals
        active_diseases = set(
            s['disease_name'] for s in signals
            if s.get('disease_name')
        )
        history_qs = Signal.objects.filter(
            location_country_iso=country_iso,
            created_at__gte=now - timedelta(days=90),
            created_at__lt=cutoff,  # Don't overlap with recent
        )
        if active_diseases:
            history_qs = history_qs.filter(disease_name__in=active_diseases)

        history_signals = list(
            history_qs.order_by('-created_at').values(
                'id', 'original_text', 'disease_name', 'pillar',
                'source_name', 'created_at', 'trust__score',
            )[:20]
        )

    # ── Previous briefing recommendations (last 3) ───────────────────
    prev_query = Briefing.objects.filter(status='published').order_by('-generated_at')
    if country_iso:
        prev_query = prev_query.filter(
            Q(country_iso=country_iso) | Q(scope='daily_global')
        )
    previous_briefings = []
    for b in prev_query[:3]:
        content = b.content or {}
        actions = content.get('recommended_actions', [])
        previous_briefings.append({
            'generated_at': b.generated_at.isoformat() if b.generated_at else '',
            'scope': b.scope,
            'country_iso': b.country_iso,
            'executive_summary': content.get('executive_summary', ''),
            'open_actions': actions,
        })

    # ── Volume trend (signals per pillar per day, last 7d) ───────────
    trend_qs = Signal.objects.filter(created_at__gte=now - timedelta(days=7))
    if country_iso:
        trend_qs = trend_qs.filter(location_country_iso=country_iso)

    pillar_trend = list(
        trend_qs.values('pillar')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    # ── Active alerts ────────────────────────────────────────────────
    active_alerts = list(
        Alert.objects.filter(
            created_at__gte=cutoff,
            acknowledged_at__isnull=True,
        ).select_related('signal').values(
            'id', 'risk_level', 'trigger_reason', 'confidence_score',
            'signal__location_country_iso', 'signal__disease_name',
        ).order_by('-created_at')[:20]
    )

    # ── Source diversity ──────────────────────────────────────────────
    source_count = base_qs.values('source_name').distinct().count()

    elapsed_ms = int((time.monotonic() - start) * 1000)

    context = {
        'scope': scope,
        'country_iso': country_iso,
        'period': {
            'start': cutoff.isoformat(),
            'end': now.isoformat(),
            'hours': hours_back,
        },
        'signals': {
            'total': len(signals),
            'by_pillar': {p: len(items) for p, items in pillars.items()},
            'items': signals,
        },
        'history': {
            'total': len(history_signals),
            'items': history_signals,
        },
        'previous_briefings': previous_briefings,
        'pillar_trend': pillar_trend,
        'active_alerts': active_alerts,
        'source_count': source_count,
        'gatherer_ms': elapsed_ms,
    }

    logger.info(
        "[Gatherer] Assembled context: %d signals, %d history, %d prev briefings (%dms)",
        len(signals), len(history_signals), len(previous_briefings), elapsed_ms,
    )
    return context


# ============================================================================
# AGENT 2: ANALYST — LLM cross-pillar reasoning
# ============================================================================

_ANALYST_SYSTEM = """You are a WHO AFRO health intelligence analyst with 20 years experience.

You will receive intelligence signals grouped by pillar for a specific scope (Africa region or single country).

Your job is NOT to summarize. Your job is to ANALYZE:

1. CROSS-PILLAR CORRELATIONS
   - Find connections between different pillars that amplify risk.
   - Example: a funding cut (funding pillar) + an outbreak (outbreak pillar) + conflict (conflict pillar) in the same country = compounding crisis.
   - If no connections exist, say so honestly.
   - Each correlation MUST reference specific signal IDs.

2. TRENDS
   - Is the situation getting worse, stable, or improving?
   - Compare signal volume and severity to the historical data provided.
   - Be specific: "cholera signals increased 3x in 7 days" not "situation is worsening."

3. RISK TRAJECTORY
   - Based on current data, what is likely to happen in the next 7 days if no action is taken?
   - State clearly if evidence is insufficient for prediction.

4. INFORMATION GAPS
   - What critical information is MISSING from the available signals?
   - What questions should the intelligence team investigate?
   - Gaps are as valuable as findings.

RULES:
- Every claim MUST reference specific signal IDs from the data.
- Do NOT say "appears to be", "seems like", "may indicate." State what the evidence shows or say you don't have enough evidence.
- Do NOT hallucinate sources or data not present in the context.
- If the situation doesn't warrant concern, say so plainly.

OUTPUT FORMAT: Respond with ONLY a JSON object (no markdown, no explanation):
{
  "correlations": [
    {
      "title": "short description",
      "pillars": ["pillar1", "pillar2"],
      "signal_ids": [id1, id2, ...],
      "description": "detailed explanation with evidence",
      "severity": "critical|high|medium|low"
    }
  ],
  "trends": [
    {
      "indicator": "what is trending",
      "direction": "rising|falling|stable",
      "evidence": "specific data points",
      "signal_ids": [id1, ...]
    }
  ],
  "risk_trajectory": {
    "level": "critical|high|medium|low",
    "direction": "worsening|stable|improving",
    "reasoning": "evidence-based explanation",
    "seven_day_outlook": "what happens if no action"
  },
  "gaps": [
    {
      "area": "what information is missing",
      "why_critical": "why this gap matters",
      "suggested_action": "what to investigate"
    }
  ]
}"""


def _analyze_context(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agent 2: Run LLM analysis on the gathered context.
    Returns structured analysis with signal ID citations.

    Token budget management: dynamically reduces signal count if
    the prompt would exceed the model's context window.
    """
    start = time.monotonic()

    # Build a focused user prompt from context
    signals = context['signals']['items']
    history = context['history']['items']

    # Compute token budget for the user prompt
    max_response_tokens = 2048
    budget = _compute_budget(_ANALYST_SYSTEM, max_response_tokens)

    # Reserve tokens for the non-signal parts of the prompt (header, history, trends, etc.)
    # We'll build those parts first, then fill remaining budget with signals.

    # Previous action items
    prev_actions = []
    for pb in context.get('previous_briefings', []):
        for act in pb.get('open_actions', []):
            if isinstance(act, dict):
                prev_actions.append(
                    f"[{pb['generated_at'][:10]}] {act.get('action', str(act))}"
                )
            else:
                prev_actions.append(f"[{pb['generated_at'][:10]}] {act}")

    # Pillar volume trend
    trend_summary = ", ".join(
        f"{t['pillar']}: {t['count']} signals"
        for t in context.get('pillar_trend', [])
    )

    # History lines (cap at 3 for extreme LLM speed)
    history_lines = []
    for h in history[:3]:
        history_lines.append(
            f"[{h.get('pillar','?')}] [{h.get('disease_name','?')}] "
            f"{h.get('original_text','')[:50]}"
        )

    # Build the non-signal parts of the prompt
    prompt_skeleton = (
        f"SCOPE: {context['scope']}\n"
        f"COUNTRY: {context.get('country_iso') or 'All AFRO Region'}\n"
        f"PERIOD: {context['period']['start'][:16]} to {context['period']['end'][:16]}\n\n"
        f"HISTORICAL CONTEXT:\n"
        f"{chr(10).join(history_lines) if history_lines else 'No historical signals.'}\n\n"
        f"7-DAY PILLAR VOLUME TREND:\n"
        f"{trend_summary or 'No trend data.'}\n\n"
        f"PREVIOUS BRIEFING ACTIONS (unresolved):\n"
        f"{chr(10).join(prev_actions) if prev_actions else 'No previous actions.'}\n\n"
        f"Analyze this intelligence. Produce the structured JSON analysis."
    )

    skeleton_tokens = estimate_tokens(prompt_skeleton)
    signal_budget = min(budget - skeleton_tokens, 800)  # MAX 800 tokens for extreme speed

    # Prioritize signals: P1 first, then P2, then others
    priority_order = {'P1': 0, 'P2': 1, 'P3': 2, 'P4': 3}
    sorted_signals = sorted(
        signals, key=lambda s: priority_order.get(s.get('priority', 'P4'), 4)
    )

    # Dynamically add signals until heavily capped budget is exhausted
    signal_lines = []
    tokens_used = 0
    signals_included = 0
    for s in sorted_signals:
        trust = s.get('trust__score', 'N/A')
        trust_level = s.get('trust__trust_level', 'unknown')
        line = (
            f"[{s.get('pillar','?')}] [{s.get('priority','?')}] "
            f"[{s.get('location_country_iso','?')}] "
            f"{s.get('original_text','')[:60]}"
        )
        line_tokens = estimate_tokens(line)
        if tokens_used + line_tokens > signal_budget:
            break
        signal_lines.append(line)
        tokens_used += line_tokens
        signals_included += 1

    if signals_included < len(signals):
        logger.info(
            "[Analyst] Token budget trimmed signals: %d/%d included (%d tokens of %d budget)",
            signals_included, len(signals), tokens_used, signal_budget,
        )

    user_prompt = (
        f"SCOPE: {context['scope']}\n"
        f"COUNTRY: {context.get('country_iso') or 'All AFRO Region'}\n"
        f"PERIOD: {context['period']['start'][:16]} to {context['period']['end'][:16]}\n\n"
        f"SIGNALS ({len(signals)} total, showing {signals_included}, {context['signals']['by_pillar']}):\n"
        f"{chr(10).join(signal_lines) if signal_lines else 'No signals in this period.'}\n\n"
        f"HISTORICAL CONTEXT (last 90 days):\n"
        f"{chr(10).join(history_lines) if history_lines else 'No historical signals for comparison.'}\n\n"
        f"7-DAY PILLAR VOLUME TREND:\n"
        f"{trend_summary or 'No trend data available.'}\n\n"
        f"PREVIOUS BRIEFING ACTIONS (unresolved):\n"
        f"{chr(10).join(prev_actions) if prev_actions else 'No previous actions to track.'}\n\n"
        f"ACTIVE UNACKNOWLEDGED ALERTS: {len(context.get('active_alerts', []))}\n\n"
        f"Analyze this intelligence. Produce the structured JSON analysis."
    )

    logger.info(
        "[Analyst] Prompt: ~%d tokens (budget: %d, context window: %d)",
        estimate_tokens(_ANALYST_SYSTEM + user_prompt), budget + estimate_tokens(_ANALYST_SYSTEM),
        get_context_window(),
    )

    result = chat_json(
        system_prompt=_ANALYST_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.2,
        max_tokens=max_response_tokens,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    if result is None:
        logger.error("[Analyst] Failed to produce valid JSON — using empty analysis")
        result = {
            'correlations': [],
            'trends': [],
            'risk_trajectory': {
                'level': 'medium', 'direction': 'stable',
                'reasoning': 'Analysis failed — LLM did not produce valid output',
                'seven_day_outlook': 'Unable to assess',
            },
            'gaps': [{
                'area': 'Analysis Engine',
                'why_critical': 'Automated analysis failed for this cycle',
                'suggested_action': 'Manual review of raw signals recommended',
            }],
        }

    result['_meta'] = {'analyst_ms': elapsed_ms}
    logger.info("[Analyst] Analysis complete in %dms", elapsed_ms)
    return result


# ============================================================================
# AGENT 3: VERIFIER — Trust checks + contradiction detection
# ============================================================================

def _verify_analysis(
    analysis: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Agent 3: Verify each claim in the analysis.

    Deterministic checks:
    - Trust scores of cited signals
    - Source diversity (independent source count)
    - Flag single-source or low-confidence claims

    Returns the analysis with confidence metadata attached to each item.
    """
    start = time.monotonic()

    signals_by_id = {
        s['id']: s for s in context['signals']['items']
    }

    verified_correlations = []
    total_flags = 0

    for corr in analysis.get('correlations', []):
        cited_ids = corr.get('signal_ids', [])
        cited = [signals_by_id[sid] for sid in cited_ids if sid in signals_by_id]

        # Trust score analysis
        trust_scores = [c.get('trust__score', 0) for c in cited if c.get('trust__score')]
        avg_trust = sum(trust_scores) / len(trust_scores) if trust_scores else 0

        # Source diversity
        sources = set(c.get('source_name', '') for c in cited)
        source_count = len(sources)

        # Flags
        flags = []
        if source_count <= 1:
            flags.append('SINGLE_SOURCE')
        if avg_trust < 50:
            flags.append('LOW_CONFIDENCE')
        if not cited:
            flags.append('UNVERIFIABLE — no valid signal IDs')

        total_flags += len(flags)

        # Determine confidence
        if flags:
            confidence = 'low'
        elif avg_trust >= 70 and source_count >= 2:
            confidence = 'high'
        else:
            confidence = 'medium'

        verified_correlations.append({
            **corr,
            'verification': {
                'confidence': confidence,
                'avg_trust_score': round(avg_trust, 1),
                'source_count': source_count,
                'sources': list(sources),
                'flags': flags,
                'cited_signals_found': len(cited),
                'cited_signals_requested': len(cited_ids),
            },
        })

    # Verify trends
    verified_trends = []
    for trend in analysis.get('trends', []):
        cited_ids = trend.get('signal_ids', [])
        cited = [signals_by_id[sid] for sid in cited_ids if sid in signals_by_id]
        sources = set(c.get('source_name', '') for c in cited)
        flags = []
        if len(sources) <= 1:
            flags.append('SINGLE_SOURCE')
        if not cited:
            flags.append('UNVERIFIABLE')
        total_flags += len(flags)

        verified_trends.append({
            **trend,
            'verification': {
                'confidence': 'low' if flags else ('high' if len(sources) >= 2 else 'medium'),
                'source_count': len(sources),
                'flags': flags,
            },
        })

    # Overall briefing confidence
    all_confidences = (
        [c['verification']['confidence'] for c in verified_correlations]
        + [t['verification']['confidence'] for t in verified_trends]
    )
    if not all_confidences:
        overall = 'low'
    elif all(c == 'high' for c in all_confidences):
        overall = 'high'
    elif any(c == 'low' for c in all_confidences):
        overall = 'low' if all_confidences.count('low') > len(all_confidences) / 2 else 'medium'
    else:
        overall = 'medium'

    elapsed_ms = int((time.monotonic() - start) * 1000)

    verified = {
        'correlations': verified_correlations,
        'trends': verified_trends,
        'risk_trajectory': analysis.get('risk_trajectory', {}),
        'gaps': analysis.get('gaps', []),
        'overall_confidence': overall,
        'total_flags': total_flags,
        '_meta': {'verifier_ms': elapsed_ms},
    }

    logger.info(
        "[Verifier] Done in %dms — confidence=%s, flags=%d",
        elapsed_ms, overall, total_flags,
    )
    return verified


# ============================================================================
# AGENT 4: COMPOSER — LLM briefing writer
# ============================================================================

_COMPOSER_SYSTEM = """You are writing a briefing for WHO AFRO senior leadership.

You will receive a VERIFIED ANALYSIS with confidence ratings and evidence.

RULES:
- Executive summary: MAX 4 sentences. If they read nothing else, they get the full picture.
- Every recommendation must have an URGENCY tag: immediate | 48h | this_week | monitor
- Confidence tags: mark sections based on the verification data provided.
  Use [HIGH CONFIDENCE], [MEDIUM CONFIDENCE], or [LOW CONFIDENCE — single source]
- INFORMATION GAPS section is MANDATORY — always state what we DON'T know.
- Tone: analytical, not alarmist. State facts, cite evidence.
- If the situation doesn't warrant action, say so. Don't manufacture urgency.
- Do NOT add information not present in the analysis.
- Do NOT invent numbers, dates, or sources.
- If a claim is flagged LOW CONFIDENCE, hedge appropriately.

OUTPUT FORMAT: Respond with ONLY a JSON object:
{
  "executive_summary": "3-4 sentence overview for leadership",
  "risk_assessment": {
    "level": "critical|high|medium|low",
    "direction": "worsening|stable|improving",
    "comparison": "compared to X period",
    "reasoning": "evidence-based explanation"
  },
  "cross_pillar_correlation": "paragraph explaining how different pillars interact (or stating no significant correlations found)",
  "recommended_actions": [
    {
      "action": "specific action to take",
      "urgency": "immediate|48h|this_week|monitor",
      "pillar": "which pillar this relates to",
      "rationale": "why this action, what evidence supports it"
    }
  ],
  "open_actions_status": [
    {
      "from_date": "date of previous briefing",
      "action": "what was recommended",
      "status": "no update | resolved | still pending"
    }
  ],
  "information_gaps": [
    {
      "area": "what we don't know",
      "criticality": "high|medium|low",
      "suggested_investigation": "what to look into"
    }
  ],
  "sources_summary": {
    "total_signals": 0,
    "total_sources": 0,
    "confidence_distribution": {"high": 0, "medium": 0, "low": 0}
  }
}"""


def _compose_briefing(
    verified: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Agent 4: Compose the final briefing from verified analysis.
    Returns structured JSON content for the Briefing model.

    Token budget management: trims verified analysis if it
    would exceed the model's context window.
    """
    start = time.monotonic()

    # Compute token budget
    max_response_tokens = 2048
    budget = _compute_budget(_COMPOSER_SYSTEM, max_response_tokens)

    # Prepare previous actions for the composer
    prev_actions_text = ""
    for pb in context.get('previous_briefings', []):
        actions = pb.get('open_actions', [])
        if actions:
            prev_actions_text += f"\nFrom {pb['generated_at'][:10]}:\n"
            for a in actions:
                if isinstance(a, dict):
                    prev_actions_text += f"  - {a.get('action', str(a))}\n"
                else:
                    prev_actions_text += f"  - {a}\n"

    # Build non-analysis parts
    static_parts = (
        f"SCOPE: {context['scope']}\n"
        f"COUNTRY: {context.get('country_iso') or 'All AFRO Region'}\n"
        f"PERIOD: {context['period']['start'][:16]} to {context['period']['end'][:16]}\n\n"
        f"SIGNAL STATISTICS:\n"
        f"- Total signals analyzed: {context['signals']['total']}\n"
        f"- Distinct sources: {context['source_count']}\n"
        f"- Signals by pillar: {context['signals']['by_pillar']}\n\n"
        f"PREVIOUS BRIEFING ACTIONS TO TRACK:\n"
        f"{prev_actions_text or 'None'}\n\n"
        f"OVERALL CONFIDENCE: {verified.get('overall_confidence', 'medium')}\n"
        f"TOTAL VERIFICATION FLAGS: {verified.get('total_flags', 0)}\n\n"
        f"Compose the final briefing for WHO AFRO leadership. Produce the structured JSON."
    )

    static_tokens = estimate_tokens(static_parts)
    analysis_budget = budget - static_tokens

    # Serialize the verified analysis, trimming progressively if too large
    analysis_json = json.dumps(verified, indent=2, default=str)
    analysis_tokens = estimate_tokens(analysis_json)

    if analysis_tokens > analysis_budget:
        logger.info(
            "[Composer] Verified analysis too large (%d tokens > %d budget). Trimming.",
            analysis_tokens, analysis_budget,
        )
        # Progressive trimming strategy:
        # 1. Remove indent formatting (saves ~40% space)
        trimmed = dict(verified)
        analysis_json = json.dumps(trimmed, indent=None, default=str)
        analysis_tokens = estimate_tokens(analysis_json)

        # 2. If still too large, truncate individual correlation descriptions
        if analysis_tokens > analysis_budget and 'correlations' in trimmed:
            for corr in trimmed.get('correlations', []):
                if 'description' in corr:
                    corr['description'] = corr['description'][:200]
                # Remove verbose verification details
                if 'verification' in corr:
                    corr['verification'] = {
                        'confidence': corr['verification'].get('confidence', 'unknown'),
                        'flags': corr['verification'].get('flags', []),
                    }
            analysis_json = json.dumps(trimmed, indent=None, default=str)
            analysis_tokens = estimate_tokens(analysis_json)

        # 3. If still too large, drop trends and keep only risk trajectory + correlations
        if analysis_tokens > analysis_budget:
            trimmed.pop('trends', None)
            analysis_json = json.dumps(trimmed, indent=None, default=str)
            analysis_tokens = estimate_tokens(analysis_json)

        # 4. Final resort: hard truncate the JSON string
        if analysis_tokens > analysis_budget:
            max_chars = analysis_budget * 4  # Reverse the token estimation
            analysis_json = analysis_json[:max_chars]
            analysis_json += '\n... [TRUNCATED due to token budget]'
            logger.warning(
                "[Composer] Hard-truncated analysis to %d chars.", max_chars,
            )

    user_prompt = (
        f"SCOPE: {context['scope']}\n"
        f"COUNTRY: {context.get('country_iso') or 'All AFRO Region'}\n"
        f"PERIOD: {context['period']['start'][:16]} to {context['period']['end'][:16]}\n\n"
        f"VERIFIED ANALYSIS:\n"
        f"{analysis_json}\n\n"
        f"SIGNAL STATISTICS:\n"
        f"- Total signals analyzed: {context['signals']['total']}\n"
        f"- Distinct sources: {context['source_count']}\n"
        f"- Signals by pillar: {context['signals']['by_pillar']}\n\n"
        f"PREVIOUS BRIEFING ACTIONS TO TRACK:\n"
        f"{prev_actions_text or 'None'}\n\n"
        f"OVERALL CONFIDENCE: {verified.get('overall_confidence', 'medium')}\n"
        f"TOTAL VERIFICATION FLAGS: {verified.get('total_flags', 0)}\n\n"
        f"Compose the final briefing for WHO AFRO leadership. Produce the structured JSON."
    )

    logger.info(
        "[Composer] Prompt: ~%d tokens (budget: %d, context window: %d)",
        estimate_tokens(_COMPOSER_SYSTEM + user_prompt), budget + estimate_tokens(_COMPOSER_SYSTEM),
        get_context_window(),
    )

    result = chat_json(
        system_prompt=_COMPOSER_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.3,
        max_tokens=max_response_tokens,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    if result is None:
        logger.error("[Composer] Failed to produce valid JSON — using fallback")
        result = {
            'executive_summary': (
                f"Briefing generation partially failed. "
                f"{context['signals']['total']} signals were analyzed across "
                f"{len(context['signals']['by_pillar'])} pillars. "
                f"Manual review of raw intelligence is recommended."
            ),
            'risk_assessment': {
                'level': verified.get('risk_trajectory', {}).get('level', 'medium'),
                'direction': verified.get('risk_trajectory', {}).get('direction', 'stable'),
                'comparison': 'Unable to auto-compare',
                'reasoning': 'Automated composition failed; see raw analysis.',
            },
            'cross_pillar_correlation': 'Automated composition failed. See raw pipeline data.',
            'recommended_actions': [{
                'action': 'Review raw signals manually',
                'urgency': 'immediate',
                'pillar': 'all',
                'rationale': 'Automated briefing composition failed.',
            }],
            'open_actions_status': [],
            'information_gaps': [{
                'area': 'Automated Analysis',
                'criticality': 'high',
                'suggested_investigation': 'Investigate why briefing composition failed.',
            }],
            'sources_summary': {
                'total_signals': context['signals']['total'],
                'total_sources': context['source_count'],
                'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0},
            },
        }

    result['_meta'] = {'composer_ms': elapsed_ms}
    logger.info("[Composer] Briefing composed in %dms", elapsed_ms)
    return result


# ============================================================================
# FAST PIPELINE: Single LLM call for small models (≤16K context)
# ============================================================================

_FAST_SYSTEM = """You are a WHO AFRO health intelligence analyst writing a brief for senior leadership.

You will receive health signals from the African region. Write a structured briefing.

RULES:
- Executive summary: MAX 3 sentences.
- Be specific: cite countries, diseases, numbers from the data.
- Do NOT invent data not present in the signals.
- If situation is calm, say so. Don't manufacture urgency.

OUTPUT: Respond with ONLY a JSON object:
{
  "executive_summary": "2-3 sentence overview",
  "risk_assessment": {
    "level": "critical|high|medium|low",
    "direction": "worsening|stable|improving",
    "reasoning": "brief evidence"
  },
  "cross_pillar_correlation": "1 paragraph on how pillars interact",
  "recommended_actions": [
    {"action": "specific action", "urgency": "immediate|48h|this_week|monitor", "pillar": "pillar", "rationale": "why"}
  ],
  "information_gaps": [
    {"area": "what we don't know", "criticality": "high|medium|low", "suggested_investigation": "what to look into"}
  ],
  "sources_summary": {"total_signals": 0, "total_sources": 0}
}"""


def _fast_single_call_briefing(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fast pipeline: Single LLM call for small models (≤16K context window).

    Instead of Analyst (2048 tokens) + Composer (2048 tokens) = 2 slow calls,
    this uses 1 compact call with 1024 max tokens. Brings generation from
    15+ minutes down to ~30 seconds on llama3.2:1b.
    """
    start = time.monotonic()

    signals = context['signals']['items']
    by_pillar = context['signals']['by_pillar']

    # Priority sort: P1 first
    priority_order = {'P1': 0, 'P2': 1, 'P3': 2, 'P4': 3}
    sorted_signals = sorted(
        signals, key=lambda s: priority_order.get(s.get('priority', 'P4'), 4)
    )

    # Build compact signal lines — max 10 signals, 40 chars each
    signal_lines = []
    for s in sorted_signals[:10]:
        line = (
            f"[{s.get('pillar','?')}][{s.get('priority','?')}]"
            f"[{s.get('location_country_iso','?')}] "
            f"{(s.get('original_text','') or '')[:40]}"
        )
        signal_lines.append(line)

    # Compact prompt
    user_prompt = (
        f"SCOPE: {context['scope']}\n"
        f"PERIOD: last {context['period']['hours']}h\n"
        f"PILLARS: {', '.join(f'{p}({c})' for p, c in by_pillar.items())}\n"
        f"TOTAL: {len(signals)} signals from {context['source_count']} sources\n\n"
        f"TOP SIGNALS:\n"
        f"{chr(10).join(signal_lines)}\n\n"
        f"Write the briefing JSON."
    )

    logger.info(
        "[FastPipeline] Single-call prompt: ~%d tokens",
        estimate_tokens(_FAST_SYSTEM + user_prompt),
    )

    result = chat_json(
        system_prompt=_FAST_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.3,
        max_tokens=1024,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    if result is None:
        logger.warning("[FastPipeline] LLM returned invalid JSON — using data-driven fallback")
        return None  # Caller will use data-driven fallback

    # Ensure required fields exist
    result.setdefault('sources_summary', {
        'total_signals': len(signals),
        'total_sources': context['source_count'],
        'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0},
    })
    result.setdefault('open_actions_status', [])
    result.setdefault('recommended_actions', [])
    result.setdefault('information_gaps', [])

    result['_meta'] = {'fast_pipeline_ms': elapsed_ms}
    logger.info("[FastPipeline] Briefing generated in %dms (single call)", elapsed_ms)
    return result


def _is_small_model() -> bool:
    """Check if the current LLM model has a small context window (≤16K tokens)."""
    return get_context_window() <= 16_384


# ============================================================================
# FALLBACK: Data-driven briefing (no LLM required)
# ============================================================================

def _build_data_driven_briefing(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a structured briefing from gathered context WITHOUT any LLM calls.
    Used as fallback when the LLM provider is unavailable or too slow.
    
    Produces the same JSON structure as the Composer agent so the frontend
    renders it identically.
    """
    signals = context['signals']['items']
    by_pillar = context['signals']['by_pillar']
    total = context['signals']['total']
    source_count = context['source_count']
    country_iso = context.get('country_iso')
    scope = context.get('scope', 'daily_global')

    # ── Priority breakdown ───────────────────────────────────────────
    p1 = [s for s in signals if s.get('priority') == 'P1']
    p2 = [s for s in signals if s.get('priority') == 'P2']
    p3 = [s for s in signals if s.get('priority') == 'P3']

    # ── Top diseases ─────────────────────────────────────────────────
    disease_counts: Dict[str, int] = {}
    for s in signals:
        d = s.get('disease_name', '')
        if d:
            disease_counts[d] = disease_counts.get(d, 0) + 1
    top_diseases = sorted(disease_counts.items(), key=lambda x: -x[1])[:5]

    # ── Top countries (for global scope) ─────────────────────────────
    country_counts: Dict[str, int] = {}
    for s in signals:
        c = s.get('location_country', '') or s.get('location_country_iso', '')
        if c:
            country_counts[c] = country_counts.get(c, 0) + 1
    top_countries = sorted(country_counts.items(), key=lambda x: -x[1])[:5]

    # ── Risk level ───────────────────────────────────────────────────
    if len(p1) >= 3:
        risk_level = 'critical'
        risk_direction = 'worsening'
    elif len(p1) >= 1:
        risk_level = 'high'
        risk_direction = 'worsening' if len(p1) > 1 else 'stable'
    elif len(p2) >= 3:
        risk_level = 'medium'
        risk_direction = 'stable'
    else:
        risk_level = 'low'
        risk_direction = 'stable'

    # ── Executive summary ────────────────────────────────────────────
    region = country_iso or 'the WHO AFRO region'
    disease_str = ', '.join(d for d, _ in top_diseases[:3]) if top_diseases else 'various health events'
    pillar_str = ', '.join(sorted(by_pillar.keys())[:4]) if by_pillar else 'multiple pillars'

    summary_parts = [
        f"In the past {context['period']['hours']} hours, {total} intelligence signals "
        f"were captured across {len(by_pillar)} pillars ({pillar_str}) from {source_count} sources "
        f"covering {region}.",
    ]
    if p1:
        summary_parts.append(
            f"{len(p1)} critical-priority (P1) signal(s) detected, primarily involving {disease_str}."
        )
    if top_countries and not country_iso:
        countries_str = ', '.join(c for c, _ in top_countries[:3])
        summary_parts.append(f"Most affected areas: {countries_str}.")
    summary_parts.append(
        f"Overall risk assessment: {risk_level.upper()} ({risk_direction}). "
        f"Note: This briefing was generated from data analysis only (LLM unavailable)."
    )

    executive_summary = ' '.join(summary_parts)

    # ── Cross-pillar correlation ─────────────────────────────────────
    if len(by_pillar) >= 2:
        pillar_list = ', '.join(f"{p} ({c} signals)" for p, c in sorted(by_pillar.items(), key=lambda x: -x[1]))
        cross_pillar = (
            f"Signals span {len(by_pillar)} pillars: {pillar_list}. "
            f"Automated cross-pillar analysis requires LLM — manual review recommended "
            f"to identify compounding risks between pillars."
        )
    else:
        cross_pillar = "Signals are concentrated in a single pillar. No cross-pillar correlations detected."

    # ── Recommended actions ──────────────────────────────────────────
    actions = []
    if p1:
        for s in p1[:3]:
            actions.append({
                'action': f"Investigate P1 signal: {(s.get('original_text', '') or 'Unknown')[:100]}",
                'urgency': 'immediate',
                'pillar': s.get('pillar', 'unknown'),
                'rationale': f"Critical priority signal from {s.get('source_name', 'unknown source')} "
                             f"in {s.get('location_country', 'unknown location')}.",
            })
    if p2:
        actions.append({
            'action': f"Review {len(p2)} high-priority (P2) signals for escalation risk",
            'urgency': '48h',
            'pillar': 'all',
            'rationale': f"P2 signals may escalate if unaddressed.",
        })
    if not actions:
        actions.append({
            'action': 'Continue routine monitoring — no immediate action required',
            'urgency': 'monitor',
            'pillar': 'all',
            'rationale': f'{total} signals monitored, none at critical threshold.',
        })

    # ── Information gaps ─────────────────────────────────────────────
    gaps = [
        {
            'area': 'LLM Analysis Unavailable',
            'criticality': 'medium',
            'suggested_investigation': (
                'This briefing was generated without AI analysis. '
                'Re-generate when Ollama/LLM service is operational for deeper cross-pillar insights.'
            ),
        },
    ]
    # Check for pillar gaps
    expected_pillars = HDIS_PILLARS
    missing_pillars = expected_pillars - set(by_pillar.keys())
    if missing_pillars:
        gaps.append({
            'area': f"No signals for pillars: {', '.join(sorted(missing_pillars))}",
            'criticality': 'low',
            'suggested_investigation': 'Verify source coverage for these health pillars.',
        })

    return {
        'executive_summary': executive_summary,
        'risk_assessment': {
            'level': risk_level,
            'direction': risk_direction,
            'comparison': 'Data-driven assessment (no historical comparison without LLM)',
            'reasoning': (
                f"Based on {len(p1)} P1, {len(p2)} P2, {len(p3)} P3 signals. "
                f"Top diseases: {', '.join(f'{d} ({c})' for d, c in top_diseases[:3]) if top_diseases else 'N/A'}."
            ),
        },
        'cross_pillar_correlation': cross_pillar,
        'recommended_actions': actions,
        'open_actions_status': [],
        'information_gaps': gaps,
        'sources_summary': {
            'total_signals': total,
            'total_sources': source_count,
            'confidence_distribution': {
                'high': len([s for s in signals if (s.get('trust__trust_level') or '') in ('verified', 'corroborated')]),
                'medium': len([s for s in signals if s.get('trust__trust_level') == 'unverified']),
                'low': len([s for s in signals if s.get('trust__trust_level') in ('unconfirmed', '', None)]),
            },
        },
    }


# ============================================================================
# ORCHESTRATOR — Runs the full pipeline
# ============================================================================

def generate_briefing(
    scope: str = 'daily_global',
    country_iso: Optional[str] = None,
    hours_back: int = 48,
    exclude_pillars: Optional[List[str]] = None,
    progress_callback: Optional[callable] = None,
) -> Briefing:
    """
    Run the full 4-agent briefing pipeline and save the result.

    Args:
        scope:            'daily_global' | 'country_focus' | 'crisis_alert'
        country_iso:      ISO3 country code (required for country_focus/crisis_alert)
        hours_back:       How many hours of signals to analyze (default 48)
        exclude_pillars:  Pillar names to exclude (e.g. ['outbreak'] for HDIS-only)

    Returns:
        Briefing model instance (status=DRAFT)
    """
    pipeline_start = time.monotonic()

    logger.info(
        "[BriefingEngine] Starting pipeline: scope=%s country=%s hours=%d exclude=%s",
        scope, country_iso or 'ALL', hours_back, exclude_pillars or 'none',
    )

    # ── Validate inputs ──────────────────────────────────────────────
    if scope in ('country_focus', 'crisis_alert') and not country_iso:
        raise ValueError(f"country_iso required for scope '{scope}'")

    # Use shorter window for crisis alerts
    if scope == 'crisis_alert':
        hours_back = min(hours_back, 24)

    # ── Agent 1: Gatherer ────────────────────────────────────────────
    if progress_callback:
        progress_callback('gathering')
    context = _gather_context(scope, country_iso, hours_back, exclude_pillars=exclude_pillars)

    # Bail early if no signals
    if context['signals']['total'] == 0:
        logger.warning("[BriefingEngine] No signals found — creating minimal briefing")
        return _create_empty_briefing(scope, country_iso, context)

    # ── Choose pipeline based on model size ────────────────────────────
    use_fast = _is_small_model()
    if use_fast:
        logger.info(
            "[BriefingEngine] Small model detected (context=%d) — using fast single-call pipeline",
            get_context_window(),
        )

    # ── Agent 2-4: Try LLM pipeline, fallback to data-driven if LLM fails ─
    try:
        if use_fast:
            # ── FAST PATH: Single LLM call for small models ─────────
            if progress_callback:
                progress_callback('analyzing')
            content = _fast_single_call_briefing(context)

            if content is None:
                # Fast pipeline returned invalid JSON — use data-driven
                raise RuntimeError("Fast pipeline returned invalid JSON")

            # Run deterministic verifier on the signals (no LLM needed)
            if progress_callback:
                progress_callback('verifying')

            # Quick trust-based confidence from signals
            trust_scores = [
                s.get('trust__score', 0)
                for s in context['signals']['items']
                if s.get('trust__score')
            ]
            avg_trust = sum(trust_scores) / len(trust_scores) if trust_scores else 0
            if avg_trust >= 70:
                overall_confidence = ConfidenceLevel.MEDIUM
            else:
                overall_confidence = ConfidenceLevel.LOW

            if progress_callback:
                progress_callback('composing')

            llm_config = LLMConfig.from_env()
            llm_model_label = f"{llm_config.provider}/{llm_config.model}"

            total_ms = int((time.monotonic() - pipeline_start) * 1000)
            timings = {
                'gatherer_ms': context.get('gatherer_ms', 0),
                'fast_pipeline_ms': content.get('_meta', {}).get('fast_pipeline_ms', 0),
                'total_ms': total_ms,
            }
            content.pop('_meta', None)

            pipeline_data = {
                'gatherer': {
                    'signals_count': context['signals']['total'],
                    'history_count': context['history']['total'],
                    'prev_briefings_count': len(context['previous_briefings']),
                    'source_count': context['source_count'],
                },
                'pipeline_mode': 'fast_single_call',
                'timings': timings,
            }

        else:
            # ── FULL PATH: 4-agent pipeline for large models ────────
            # ── Agent 2: Analyst ─────────────────────────────────────
            if progress_callback:
                progress_callback('analyzing')
            analysis = _analyze_context(context)

            # ── Agent 3: Verifier ────────────────────────────────────
            if progress_callback:
                progress_callback('verifying')
            verified = _verify_analysis(analysis, context)

            # ── Agent 4: Composer ────────────────────────────────────
            if progress_callback:
                progress_callback('composing')
            content = _compose_briefing(verified, context)

            overall_confidence = verified.get('overall_confidence', ConfidenceLevel.MEDIUM)
            llm_config = LLMConfig.from_env()
            llm_model_label = f"{llm_config.provider}/{llm_config.model}"

        # ── Assemble pipeline timings ────────────────────────────────
        total_ms = int((time.monotonic() - pipeline_start) * 1000)

        if not use_fast:
            timings = {
                'gatherer_ms': context.get('gatherer_ms', 0),
                'analyst_ms': analysis.get('_meta', {}).get('analyst_ms', 0),
                'verifier_ms': verified.get('_meta', {}).get('verifier_ms', 0),
                'composer_ms': content.get('_meta', {}).get('composer_ms', 0),
                'total_ms': total_ms,
            }

            # Clean meta from content before saving
            for obj in (analysis, verified, content):
                if obj:
                    obj.pop('_meta', None)

            pipeline_data = {
                'gatherer': {
                    'signals_count': context['signals']['total'],
                    'history_count': context['history']['total'],
                    'prev_briefings_count': len(context['previous_briefings']),
                    'source_count': context['source_count'],
                },
                'analyst': analysis,
                'verifier': {
                    'overall_confidence': verified.get('overall_confidence', 'medium'),
                    'total_flags': verified.get('total_flags', 0),
                    'correlations_verified': len(verified.get('correlations', [])),
                    'trends_verified': len(verified.get('trends', [])),
                },
                'timings': timings,
            }

    except Exception as llm_error:  # noqa: BLE001 — LLM pipeline boundary: must always fall back to data-driven briefing
        # ── FALLBACK: Data-driven briefing (no LLM) ──────────────────
        logger.warning(
            "[BriefingEngine] LLM pipeline failed (%s) — using data-driven fallback",
            str(llm_error)[:200],
        )
        if progress_callback:
            progress_callback('composing')

        content = _build_data_driven_briefing(context)
        overall_confidence = ConfidenceLevel.LOW
        llm_model_label = 'data-driven/no-llm'

        total_ms = int((time.monotonic() - pipeline_start) * 1000)
        timings = {
            'gatherer_ms': context.get('gatherer_ms', 0),
            'total_ms': total_ms,
        }
        pipeline_data = {
            'gatherer': {
                'signals_count': context['signals']['total'],
                'history_count': context['history']['total'],
                'prev_briefings_count': len(context['previous_briefings']),
                'source_count': context['source_count'],
            },
            'fallback_reason': str(llm_error)[:500],
            'timings': timings,
        }

    # ── Create Briefing ──────────────────────────────────────────────
    total_ms = int((time.monotonic() - pipeline_start) * 1000)
    briefing_tenant = resolve_tenant(iso=country_iso) if country_iso else resolve_tenant()
    briefing = Briefing.objects.create(
        briefing_type='crisis' if scope == 'crisis_alert' else 'daily',
        scope=scope,
        country_iso=country_iso or '',
        content=content,
        status=BriefingStatus.DRAFT,
        confidence_level=overall_confidence,
        signal_count=context['signals']['total'],
        source_count=context['source_count'],
        generation_time_ms=total_ms,
        llm_model=llm_model_label,
        pipeline_data=pipeline_data,
        generated_by='briefing_engine',
        period_start=timezone.now() - timedelta(hours=hours_back),
        period_end=timezone.now(),
        tenant=briefing_tenant,
    )

    logger.info(
        "[BriefingEngine] Briefing #%d created: scope=%s confidence=%s "
        "signals=%d time=%dms llm=%s",
        briefing.id, scope, overall_confidence,
        context['signals']['total'], total_ms, llm_model_label,
    )
    return briefing


def _create_empty_briefing(
    scope: str,
    country_iso: Optional[str],
    context: Dict[str, Any],
) -> Briefing:
    """Create a briefing when no signals are available."""
    country_label = country_iso or 'AFRO Region'
    llm_config = LLMConfig.from_env()

    return Briefing.objects.create(
        briefing_type='daily',
        scope=scope,
        country_iso=country_iso or '',
        content={
            'executive_summary': (
                f"No new intelligence signals were recorded for {country_label} "
                f"in the last {context['period']['hours']} hours. "
                f"This may indicate a data collection gap rather than an absence of events. "
                f"Manual verification of source availability is recommended."
            ),
            'risk_assessment': {
                'level': 'low',
                'direction': 'stable',
                'comparison': 'No data for comparison',
                'reasoning': 'No signals available for analysis.',
            },
            'cross_pillar_correlation': 'No signals available for cross-pillar analysis.',
            'recommended_actions': [{
                'action': 'Verify data source availability and connectivity',
                'urgency': 'immediate',
                'pillar': 'all',
                'rationale': 'Zero signals may indicate collection failure.',
            }],
            'open_actions_status': [],
            'information_gaps': [{
                'area': 'Data Collection',
                'criticality': 'high',
                'suggested_investigation': 'Check if all RSS feeds and APIs are responding.',
            }],
            'sources_summary': {
                'total_signals': 0,
                'total_sources': 0,
                'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0},
            },
        },
        status=BriefingStatus.DRAFT,
        confidence_level=ConfidenceLevel.LOW,
        signal_count=0,
        source_count=0,
        generation_time_ms=int(context.get('gatherer_ms', 0)),
        llm_model=f"{llm_config.provider}/{llm_config.model}",
        pipeline_data={
            'gatherer': {'signals_count': 0, 'reason': 'no_signals'},
            'analyst': None,
            'verifier': None,
            'timings': {'gatherer_ms': context.get('gatherer_ms', 0), 'total_ms': context.get('gatherer_ms', 0)},
        },
        generated_by='briefing_engine',
        period_start=timezone.now() - timedelta(hours=context['period']['hours']),
        period_end=timezone.now(),
        tenant=resolve_tenant(iso=country_iso) if country_iso else resolve_tenant(),
    )
