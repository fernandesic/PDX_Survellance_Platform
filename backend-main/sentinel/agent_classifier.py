"""
AI Agent Classifier — Fused pipeline (Monitor → Review → Notify).

Consolidates logic from sentinel/tasks.py auto_triage_signal (Celery-based LLM triage).

Uses hdis.llm_client.chat_json() which reads LLM config from .env
(currently: Ollama llama3.2:1b local — no API key needed).

Pipeline:
    1. monitor_classify(signal)  → LLM decides: area_alert / continent_alert / no_alert
    2. review_assess(signal_id, classification, history) → LLM assesses severity + notification scope
    3. notify_officers(signal, review_result) → sends email/telegram for critical/high alerts
    4. classify_new_signals() → scheduled entry point (processes unclassified signals)
"""

import json
import logging
import os
import smtplib
import time
from concurrent.futures import ThreadPoolExecutor

import requests as http_requests
from django.core.mail import send_mail
from django.conf import settings
from django.db import DatabaseError
from django.utils import timezone
from hdis.llm_client import LLMConfig

logger = logging.getLogger(__name__)

# Failure modes we expect from hdis.llm_client.chat()/chat_json() and the
# transport beneath them. Caught at LLM call sites so a malformed response
# or transient network blip never aborts the agent pipeline — the call site
# always has a deterministic fallback below the except block.
_LLM_ERRORS = (
    RuntimeError,
    http_requests.RequestException,
    ValueError,
    AttributeError,
    KeyError,
    TypeError,
)

# Failure modes we expect from Django ORM queries that are advisory (e.g.
# dedup checks, telemetry reads). The pipeline must still complete if these
# fail, so the call site logs and continues without the optional data.
_DB_ERRORS = (DatabaseError, AttributeError, ValueError, TypeError)

# Dedicated cloud LLM config for the agent classifier.
# Reads AGENT_LLM_* env vars so this pipeline uses OpenAI/cloud independently
# of the global LLM_PROVIDER (which may be Ollama for sensitive workloads).
# If AGENT_LLM_PROVIDER is not set, defaults gracefully to Ollama.
_AGENT_CONFIG = LLMConfig.from_env(prefix="AGENT_LLM")


# ── AgentRun / AgentStep persistence helpers ─────────────────────────────

def _start_run(signal) -> 'AgentRun':
    from sentinel.models import AgentRun, AgentRunStatus
    run = AgentRun.objects.create(
        signal=signal,
        status=AgentRunStatus.RUNNING,
        provider=_AGENT_CONFIG.provider or '',
        model_name=_AGENT_CONFIG.model or '',
    )
    logger.debug("AgentRun %s started for signal %s", run.run_id, signal.id)
    return run


def _log_step(
    run: 'AgentRun',
    step_number: int,
    kind: str,
    agent_name: str = '',
    input_summary: str = '',
    output_summary: str = '',
    reasoning: str = '',
    citations: list | None = None,
    latency_ms: int = 0,
    tokens_used: int | None = None,
    model_name: str = '',
) -> 'AgentStep':
    from sentinel.models import AgentStep
    step = AgentStep.objects.create(
        run=run,
        step_number=step_number,
        kind=kind,
        agent_name=agent_name,
        input_summary=input_summary,
        output_summary=output_summary,
        reasoning=reasoning,
        citations=citations or [],
        latency_ms=latency_ms,
        tokens_used=tokens_used,
        model_name=model_name or run.model_name,
    )
    return step


def _finish_run(run: 'AgentRun', status: str, confidence: float | None = None, corroboration_count: int = 0, error: str = '') -> None:
    from sentinel.models import AgentRunStatus
    run.status = status
    run.finished_at = timezone.now()
    if confidence is not None:
        from decimal import Decimal
        run.confidence = Decimal(str(round(confidence, 3)))
    run.corroboration_count = corroboration_count
    if error:
        run.error_message = error
    run.save(update_fields=['status', 'finished_at', 'confidence', 'corroboration_count', 'error_message'])
    logger.debug("AgentRun %s finished: %s", run.run_id, status)


# ── Step 3 (new): Corroborate — count independent sources in last 72h ─────

def corroborate(signal) -> dict:
    """
    Query for independent corroborating signals in the last 72 hours for the
    same disease + country. Returns count + per-source list for _log_step citations.

    Bias rules applied after counting:
      - ≥2 Tier-1 sources AND classification was 'uncertain' → escalate to 'area_alert'
      - <1 source total AND all sources Tier-3 → demote 'area_alert' to 'uncertain'
    These rules are advisory — the caller decides whether to apply them.
    """
    from django.utils import timezone
    from datetime import timedelta
    from sentinel.models import Signal

    cutoff = timezone.now() - timedelta(hours=72)

    qs = (
        Signal.objects
        .filter(
            disease_name=signal.disease_name,
            location_country_iso=signal.location_country_iso,
            created_at__gte=cutoff,
        )
        .exclude(pk=signal.pk)
        .values('source_name', 'source_tier', 'source_url', 'source_timestamp')
        .order_by('source_tier', 'source_name')
    )

    seen_sources: dict[str, dict] = {}
    for row in qs:
        name = row['source_name']
        if name not in seen_sources:
            seen_sources[name] = {
                'source_name': name,
                'tier': row['source_tier'],
                'source_url': row['source_url'],
                'matched_at': (row['source_timestamp'] or timezone.now()).isoformat(),
            }

    sources = list(seen_sources.values())
    count = len(sources)
    tier1_count = sum(1 for s in sources if s['tier'] is not None and int(s['tier']) == 1)

    return {
        'count': count,
        'tier1_count': tier1_count,
        'sources': sources,
    }


# ── Prompts (Monitor + Review) ─────────

CLASSIFY_SYSTEM_PROMPT = (
    'You are an expert epidemiologist specialising in early disease-outbreak '
    'detection for the WHO African Region (AFRO). Your job is to assess '
    'individual signals from a disease-surveillance platform and decide '
    'whether they warrant alerting public health officials, and to extract '
    'any quantitative epidemiological metrics (cases and deaths).\n\n'
    'Respond in valid JSON with exactly four keys:\n'
    '  "classification": one of "area_alert", "continent_alert", '
    '"no_alert", or "uncertain"\n'
    '  "rationale": a concise explanation (2-3 sentences) grounded in the '
    'signal data.\n'
    '  "cases": the total number of reported cases (integer), or null if not mentioned\n'
    '  "deaths": the total number of reported deaths (integer), or null if not mentioned\n\n'
    'Do not include any text outside the JSON object.'
)

CLASSIFY_CONSERVATIVE_SUFFIX = (
    '\n\nFRAMING: You are biased toward CAUTION. False alarms waste limited '
    'analyst attention and erode trust in the system. Only escalate when the '
    'evidence is unambiguous. When in doubt, prefer the lower classification.'
)

CLASSIFY_AGGRESSIVE_SUFFIX = (
    '\n\nFRAMING: You are biased toward VIGILANCE. A missed outbreak costs lives '
    'and the next signal may not arrive in time. When in doubt, prefer the '
    'higher classification — it can always be downgraded by the reviewer.'
)


SKEPTIC_SYSTEM_PROMPT = (
    'You are a skeptical epidemiologist. Two automated passes disagreed on a '
    'disease-surveillance signal. Your job: argue the case for the LOWER '
    'classification. Find every reason this signal might NOT warrant escalation: '
    'weak source, unverified claims, seasonal baseline, ambiguous wording, '
    'unrelated context. Be specific.\n\n'
    'Respond in valid JSON with exactly two keys:\n'
    '  "argument": 2-3 sentences making the strongest case for downgrading.\n'
    '  "preferred_classification": one of "area_alert", "continent_alert", '
    '"no_alert", "uncertain".\n\n'
    'Do not include any text outside the JSON object.'
)

HAWK_SYSTEM_PROMPT = (
    'You are a vigilant epidemiologist. Two automated passes disagreed on a '
    'disease-surveillance signal. Your job: argue the case for the HIGHER '
    'classification. Find every reason this signal MIGHT warrant escalation: '
    'novel pathogen risk, cross-border potential, vulnerable population, '
    'historical precedent, deteriorating context. Be specific.\n\n'
    'Respond in valid JSON with exactly two keys:\n'
    '  "argument": 2-3 sentences making the strongest case for escalating.\n'
    '  "preferred_classification": one of "area_alert", "continent_alert", '
    '"no_alert", "uncertain".\n\n'
    'Do not include any text outside the JSON object.'
)

ADJUDICATOR_SYSTEM_PROMPT = (
    'You are an adjudicator for a disease-surveillance system. You will be '
    'shown: (1) the original signal data, (2) two initial classifications that '
    'disagreed, (3) a Skeptic argument for the lower classification, (4) a '
    'Hawk argument for the higher classification. Your job: weigh both '
    'arguments against the actual evidence and rule on the final '
    'classification, with a calibrated confidence.\n\n'
    'Confidence scale:\n'
    '  0.50 = coin-flip, equally good arguments on both sides\n'
    '  0.65 = lean one way but the other side has a real point\n'
    '  0.80 = clear winner, dissent has only weak counterarguments\n'
    '  0.90+ = overwhelming evidence, dissent is essentially noise\n\n'
    'Respond in valid JSON with exactly three keys:\n'
    '  "classification": one of "area_alert", "continent_alert", "no_alert", '
    '"uncertain"\n'
    '  "confidence": a number between 0.50 and 0.95\n'
    '  "ruling": 2-3 sentences explaining which argument prevailed and why, '
    'referencing the actual evidence (not just whose argument was prettier).\n\n'
    'Do not include any text outside the JSON object.'
)


REVIEW_SYSTEM_PROMPT = (
    'You are a senior public health intelligence analyst for WHO AFRO. '
    'You are given a newly classified disease-surveillance alert and a history '
    'of recent past alerts. Your job is to:\n'
    '1. Assess the SEVERITY of the new alert relative to the historical baseline '
    '(low / moderate / high / critical).\n'
    '2. Determine the NOTIFICATION SCOPE: who needs to be informed?\n'
    '   - "local": local health authorities and clinicians in the affected area only\n'
    '   - "continental": regional/continental health bodies (e.g. Africa CDC, ECDC)\n'
    '   - "worldwide": global bodies (e.g. WHO HQ) plus all of the above\n'
    '3. Describe the specific GROUPS TO NOTIFY in plain English.\n\n'
    'Respond in valid JSON with exactly four keys:\n'
    '  "severity": one of "low", "moderate", "high", "critical"\n'
    '  "notification_scope": one of "local", "continental", "worldwide"\n'
    '  "notify_groups": a concise plain-English list of who to notify\n'
    '  "reasoning": 1-2 sentences explaining your assessment, explicitly '
    'referencing how this alert compares to the history.\n\n'
    'Do not include any text outside the JSON object.'
)


REFLECT_SYSTEM_PROMPT = (
    'You are a meta-reasoning auditor for a disease-surveillance pipeline. '
    'You will be shown a signal and the pipeline\'s final classification, '
    'severity, corroboration count, and the reasoning produced by earlier steps. '
    'Your single job: check whether the reasoning is CONSISTENT with the '
    'evidence. Are there logical gaps, contradictions, or unjustified leaps?\n\n'
    'Respond in valid JSON with exactly two keys:\n'
    '  "consistent": true or false\n'
    '  "comment": one sentence explaining your verdict.\n\n'
    'Do not include any text outside the JSON object.'
)


# ── Step 1: Classify a single signal (Monitor agent) ─────────────────────

def _safe_int(value) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.replace(',', '').strip())
        except ValueError:
            return None
    return None


def _compose_alert_narrative(
    signal,
    review_result: dict,
    citations: list,
    confidence: float | None,
) -> str:
    """
    Use the cloud LLM to write a 2-3 sentence intelligence narrative for the
    Telegram alert. Returns plain text (no HTML, no markdown). Falls back to
    a short signal-text excerpt if the LLM call fails.
    """
    snippet = (signal.translated_text or signal.original_text or '').strip()[:1200]
    review_reasoning = (review_result.get('reasoning') or '').strip()
    severity = review_result.get('severity', 'uncertain')
    classification = signal.ai_classification or 'unclassified'
    src_lines = []
    for c in (citations or [])[:5]:
        nm = (c.get('source_name') or '').strip()
        tier = c.get('tier', '?')
        if nm:
            src_lines.append(f"- {nm} (T{tier})")
    src_block = '\n'.join(src_lines) or '(none recorded)'

    conf_str = f"{int(confidence * 100)}%" if confidence is not None else 'n/a'

    system_prompt = (
        'You are an intelligence analyst writing a 2-3 sentence narrative for '
        'a WHO regional officer who will read it on Telegram. Be specific and '
        'concrete. State (a) what the source actually said, (b) why it warrants '
        'this severity, (c) the most useful next step. No fluff, no boilerplate, '
        'no markdown, no bullet points, no headings. Plain text only. '
        'Hard limit: 350 characters.'
    )
    user_prompt = (
        f'Disease: {signal.disease_name or "Unknown"}\n'
        f'Country: {signal.location_country or "Unknown"}\n'
        f'Severity (LLM review): {severity}\n'
        f'Classification: {classification}\n'
        f'Cases: {signal.reported_cases or "?"} | Deaths: {signal.reported_deaths or "?"}\n'
        f'Confidence: {conf_str}\n'
        f'Sources verified:\n{src_block}\n\n'
        f'Original article excerpt:\n"""{snippet}"""\n\n'
        f'Review-step reasoning (already on file):\n{review_reasoning}\n\n'
        'Write the narrative now.'
    )
    try:
        from hdis.llm_client import chat
        response = chat(
            system_prompt,
            user_prompt,
            temperature=0.3,
            max_tokens=220,
            config=_AGENT_CONFIG,
        )
        text = (response.content or '').strip()
        if text:
            # Keep it tight even if the LLM ignored the limit.
            return text[:600]
    except _LLM_ERRORS as e:
        logger.warning("alert narrative LLM call failed for signal %s: %s", signal.id, e)

    # Fallback: first sentence of the article + the review reasoning's first sentence.
    first_sent = snippet.split('. ')[0][:200]
    second = review_reasoning.split('. ')[0][:160] if review_reasoning else ''
    pieces = [s for s in (first_sent, second) if s]
    return '. '.join(pieces).strip() or 'No additional context available.'


def _escape_telegram_html(text: str) -> str:
    """
    Escape text for Telegram parse_mode='HTML'.

    HTML mode only requires escaping <, >, & — newlines, *, _, `, [ render
    fine as literals. We use HTML instead of legacy Markdown because Markdown
    italic spans (_x_) silently break across newlines, and LLM-generated
    reasoning routinely contains both newlines and underscores.
    """
    if not text:
        return ''
    return (
        text.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
    )


def monitor_classify(signal) -> dict:
    """
    Classify a signal using LLM (Monitor agent logic).
    Returns dict with 'classification' and 'rationale'.
    """
    from hdis.llm_client import chat_json

    signal_data = {
        'id': signal.id,
        'disease': signal.disease_name or 'Unknown',
        'country': signal.location_country,
        'iso3': signal.location_country_iso or '',
        'text': (signal.original_text or '')[:2000],
        'priority': signal.priority,
        'source': signal.source_name,
        'source_tier': signal.source_tier,
        'cases': signal.reported_cases,
        'deaths': signal.reported_deaths,
        'cross_border_risk': signal.cross_border_risk,
    }

    user_prompt = (
        'Below is a single disease-surveillance signal record. '
        'Classify whether it should trigger a public-health alert at the '
        'area level, continent level, or no alert at all.\n\n'
        f'Signal record:\n{json.dumps(signal_data, default=str, ensure_ascii=False)}'
    )

    try:
        result = chat_json(
            CLASSIFY_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.2,
            max_tokens=512,
            config=_AGENT_CONFIG,
        )
        if result:
            return {
                'classification': result.get('classification', 'uncertain'),
                'rationale': result.get('rationale', 'No rationale provided'),
                'cases': _safe_int(result.get('cases')),
                'deaths': _safe_int(result.get('deaths')),
            }
    except _LLM_ERRORS as e:
        logger.error("LLM classification failed for signal %s: %s", signal.id, e)

    return {'classification': 'uncertain', 'rationale': f'LLM unavailable'}


# ── Step 2 (extended): Two-pass classify with adversarial framings ──────

def _classify_one_pass(signal, system_prompt: str) -> dict:
    """One classification pass with a specific framing prompt. Internal helper."""
    from hdis.llm_client import chat_json

    signal_data = {
        'id': signal.id,
        'disease': signal.disease_name or 'Unknown',
        'country': signal.location_country,
        'iso3': signal.location_country_iso or '',
        'text': (signal.original_text or '')[:2000],
        'priority': signal.priority,
        'source': signal.source_name,
        'source_tier': signal.source_tier,
        'cases': signal.reported_cases,
        'deaths': signal.reported_deaths,
        'cross_border_risk': signal.cross_border_risk,
    }
    user_prompt = (
        'Below is a single disease-surveillance signal record. '
        'Classify whether it should trigger a public-health alert.\n\n'
        f'Signal record:\n{json.dumps(signal_data, default=str, ensure_ascii=False)}'
    )
    try:
        result = chat_json(
            system_prompt,
            user_prompt,
            temperature=0.2,
            max_tokens=512,
            config=_AGENT_CONFIG,
        )
        if result:
            return {
                'classification': result.get('classification', 'uncertain'),
                'rationale': result.get('rationale', ''),
                'cases': _safe_int(result.get('cases')),
                'deaths': _safe_int(result.get('deaths')),
            }
    except _LLM_ERRORS as e:
        logger.error("Classify pass failed for signal %s: %s", signal.id, e)
    return {'classification': 'uncertain', 'rationale': 'LLM unavailable', 'cases': None, 'deaths': None}


def monitor_classify_two_pass(signal) -> dict:
    """
    Run two parallel classifications with conservative + aggressive framings.
    Returns both passes plus an `agreement` flag and a tentative winner.
    Cases/deaths come from whichever pass extracted them (preferring pass_1).
    """
    conservative_prompt = CLASSIFY_SYSTEM_PROMPT + CLASSIFY_CONSERVATIVE_SUFFIX
    aggressive_prompt = CLASSIFY_SYSTEM_PROMPT + CLASSIFY_AGGRESSIVE_SUFFIX

    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(_classify_one_pass, signal, conservative_prompt)
        f2 = ex.submit(_classify_one_pass, signal, aggressive_prompt)
        pass_1 = f1.result()
        pass_2 = f2.result()

    agreement = pass_1['classification'] == pass_2['classification']
    # When agreed, that's the winner. When disagreed, debate decides — but we
    # still need a tentative winner for the case where debate fails. Pick the
    # more cautious of the two as the safe default.
    severity_order = {'no_alert': 0, 'uncertain': 1, 'area_alert': 2, 'continent_alert': 3}
    if agreement:
        tentative = pass_1['classification']
    else:
        # Tentative = the lower of the two (caution) until adjudicator rules.
        tentative = min([pass_1['classification'], pass_2['classification']],
                        key=lambda c: severity_order.get(c, 1))

    return {
        'pass_1': pass_1,
        'pass_2': pass_2,
        'agreement': agreement,
        'classification': tentative,
        'cases': pass_1['cases'] if pass_1['cases'] is not None else pass_2['cases'],
        'deaths': pass_1['deaths'] if pass_1['deaths'] is not None else pass_2['deaths'],
    }


# ── Step 4: Skeptic vs Hawk debate, then Adjudicator ─────────────────────

def _debate_call(signal, pass_1: dict, pass_2: dict, system_prompt: str) -> dict:
    from hdis.llm_client import chat_json
    user_prompt = (
        'Signal:\n'
        f'  Disease: {signal.disease_name or "Unknown"}\n'
        f'  Country: {signal.location_country} ({signal.location_country_iso or ""})\n'
        f'  Cases: {signal.reported_cases or "N/A"}, Deaths: {signal.reported_deaths or "N/A"}\n'
        f'  Source: {signal.source_name} (Tier {signal.source_tier})\n'
        f'  Excerpt: {(signal.original_text or "")[:500]}\n\n'
        f'Pass 1 (conservative framing) said: {pass_1["classification"]} — {pass_1.get("rationale", "")}\n'
        f'Pass 2 (vigilant framing) said: {pass_2["classification"]} — {pass_2.get("rationale", "")}\n\n'
        'Make your case.'
    )
    try:
        result = chat_json(
            system_prompt, user_prompt, temperature=0.3, max_tokens=400, config=_AGENT_CONFIG,
        )
        if result:
            return {
                'argument': result.get('argument', ''),
                'preferred_classification': result.get('preferred_classification', 'uncertain'),
            }
    except _LLM_ERRORS as e:
        logger.error("Debate call failed for signal %s: %s", signal.id, e)
    return {'argument': 'LLM unavailable', 'preferred_classification': 'uncertain'}


def debate(signal, pass_1: dict, pass_2: dict) -> dict:
    """
    Run Skeptic + Hawk in parallel, then Adjudicator.
    Returns final classification, confidence, and the full debate transcript.
    """
    from hdis.llm_client import chat_json

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_skeptic = ex.submit(_debate_call, signal, pass_1, pass_2, SKEPTIC_SYSTEM_PROMPT)
        f_hawk = ex.submit(_debate_call, signal, pass_1, pass_2, HAWK_SYSTEM_PROMPT)
        skeptic = f_skeptic.result()
        hawk = f_hawk.result()

    # Adjudicator
    adj_prompt = (
        'Signal:\n'
        f'  Disease: {signal.disease_name or "Unknown"}\n'
        f'  Country: {signal.location_country} ({signal.location_country_iso or ""})\n'
        f'  Cases: {signal.reported_cases or "N/A"}, Deaths: {signal.reported_deaths or "N/A"}\n'
        f'  Source: {signal.source_name} (Tier {signal.source_tier})\n'
        f'  Excerpt: {(signal.original_text or "")[:500]}\n\n'
        f'Pass 1 (conservative): {pass_1["classification"]}\n'
        f'Pass 2 (vigilant): {pass_2["classification"]}\n\n'
        f'SKEPTIC argues for {skeptic["preferred_classification"]}: {skeptic["argument"]}\n\n'
        f'HAWK argues for {hawk["preferred_classification"]}: {hawk["argument"]}\n\n'
        'Rule.'
    )
    adjudication = {'classification': 'uncertain', 'confidence': 0.5, 'ruling': 'Adjudicator unavailable'}
    try:
        result = chat_json(
            ADJUDICATOR_SYSTEM_PROMPT, adj_prompt, temperature=0.2, max_tokens=400, config=_AGENT_CONFIG,
        )
        if result:
            conf_raw = result.get('confidence', 0.5)
            try:
                conf = float(conf_raw)
            except (TypeError, ValueError):
                conf = 0.5
            adjudication = {
                'classification': result.get('classification', 'uncertain'),
                'confidence': max(0.0, min(1.0, conf)),
                'ruling': result.get('ruling', ''),
            }
    except _LLM_ERRORS as e:
        logger.error("Adjudicator failed for signal %s: %s", signal.id, e)

    return {
        'skeptic': skeptic,
        'hawk': hawk,
        'adjudication': adjudication,
        'classification': adjudication['classification'],
        'confidence': adjudication['confidence'],
    }


def _agreement_confidence(corroboration_tier1_count: int) -> float:
    """When two passes agreed, base 0.75 + 0.05 per Tier-1 corroborator, cap 0.95."""
    return min(0.95, 0.75 + 0.05 * max(0, corroboration_tier1_count))


# ── Step 7: Reflect — meta-reasoning consistency auditor ─────────────────

def _reflect(
    signal,
    classification: str,
    severity: str,
    confidence: float | None,
    corroboration_count: int,
    reasoning_summary: str,
) -> dict:
    """
    Lightweight LLM call to check whether the pipeline's reasoning is
    internally consistent with the evidence. Uses the fallback (Ollama) config
    so it doesn't consume expensive cloud tokens. Non-critical: if it fails,
    the pipeline still completes.

    Returns: {'consistent': bool, 'comment': str, 'model': str}
    """
    from hdis.llm_client import chat_json, LLMConfig

    # Prefer cheap fallback (Ollama), fall back to agent config if not set
    reflect_config = LLMConfig.fallback_from_env()
    if reflect_config is None:
        reflect_config = _AGENT_CONFIG

    user_prompt = (
        f'Signal: SIG-{signal.id}\n'
        f'  Disease: {signal.disease_name or "Unknown"}\n'
        f'  Country: {signal.location_country or "Unknown"}\n'
        f'  Cases: {signal.reported_cases or "N/A"}\n'
        f'  Deaths: {signal.reported_deaths or "N/A"}\n\n'
        f'Pipeline output:\n'
        f'  Classification: {classification}\n'
        f'  Severity: {severity}\n'
        f'  Confidence: {f"{confidence:.2f}" if confidence is not None else "N/A"}\n'
        f'  Corroborating sources: {corroboration_count}\n\n'
        f'Reasoning produced by earlier steps:\n'
        f'{reasoning_summary[:2000]}\n\n'
        f'Is this reasoning consistent with the evidence above?'
    )

    try:
        result = chat_json(
            REFLECT_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.2,
            max_tokens=200,
            config=reflect_config,
        )
        if result:
            consistent = result.get('consistent', True)
            # Coerce to bool — LLM sometimes returns string "true"/"false"
            if isinstance(consistent, str):
                consistent = consistent.lower() in ('true', '1', 'yes')
            return {
                'consistent': bool(consistent),
                'comment': result.get('comment', ''),
                'model': reflect_config.model or '',
            }
    except _LLM_ERRORS as e:
        logger.warning(
            "Reflect step failed for signal %s (non-critical): %s",
            signal.id, str(e)[:200],
        )

    # Graceful fallback — assume consistent if LLM is unavailable
    return {
        'consistent': True,
        'comment': 'Reflect step unavailable — LLM not reachable',
        'model': reflect_config.model or '',
    }


# ── Step 2: Review severity + scope (Review agent) ──────────────────────

def review_assess(signal_id: int, classification: str, recent_history: list) -> dict:
    """
    Review a classified alert for severity and notification scope (Review agent logic).
    Returns dict with 'severity', 'notification_scope', 'notify_groups', 'reasoning'.
    """
    from hdis.llm_client import chat_json

    if recent_history:
        history_str = json.dumps(recent_history, default=str, ensure_ascii=False, indent=2)
    else:
        history_str = 'No previous alerts on record — this is the first alert.'

    user_prompt = (
        'NEW ALERT\n'
        f'Signal ID: {signal_id}\n'
        f'Classification: {classification}\n\n'
        'RECENT ALERT HISTORY (most recent first):\n'
        f'{history_str}'
    )

    try:
        result = chat_json(
            REVIEW_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.2,
            max_tokens=512,
            config=_AGENT_CONFIG,
        )
        if result:
            return {
                'severity': result.get('severity', 'uncertain'),
                'notification_scope': result.get('notification_scope', 'local'),
                'notify_groups': result.get('notify_groups', ''),
                'reasoning': result.get('reasoning', 'No reasoning provided'),
            }
    except _LLM_ERRORS as e:
        logger.error("LLM review failed for signal %s: %s", signal_id, e)

    return {
        'severity': 'uncertain',
        'notification_scope': 'local',
        'notify_groups': 'Local health authorities (default)',
        'reasoning': 'LLM unavailable — defaulting to local scope',
    }


# ── Step 3: Notify officers (Notification agent) ────────────────────────

def notify_officers(signal, review_result: dict) -> dict:
    """
    Send notifications to officers for critical/high severity alerts.

    Phase 1: Email via Django send_mail() to ALERT_NOTIFY_EMAILS list.
    Phase 2: Telegram bot message to ALERT_TELEGRAM_CHAT_ID.

    Returns dict summarising what was sent.

    Kill switch: set DISABLE_AGENT_NOTIFICATIONS=1 in the environment to
    suppress all outbound channels (Telegram + email) from the agent pipeline.
    Useful when the agentic alerts are noisy and need to be quieted without
    redeploying code. Unset to re-enable.
    """
    if os.getenv('DISABLE_AGENT_NOTIFICATIONS', '').strip() in ('1', 'true', 'yes', 'on'):
        logger.info(
            "Notification skipped for signal %s: DISABLE_AGENT_NOTIFICATIONS is set",
            signal.id,
        )
        return {
            'notified': False,
            'channels': [],
            'reason': 'disabled_by_env',
        }

    severity = review_result.get('severity', 'uncertain')

    # Both channels share the same gate: classified + severity critical/high.
    # The classification + confidence gates are enforced upstream in
    # classify_single_signal, so by the time we get here the signal is
    # already deemed alert-worthy.
    should_fire = severity in ('critical', 'high')

    if not should_fire:
        logger.debug(
            "Notification skipped for signal %s: severity=%s",
            signal.id, severity,
        )
        return {'notified': False, 'reason': f'severity={severity}'}

    email_should_fire = should_fire
    telegram_should_fire = should_fire

    now = timezone.now()
    channels_notified = []

    # ── Build message content ──
    disease = signal.disease_name or 'Unknown disease'
    country = signal.location_country or 'Unknown'
    iso3 = signal.location_country_iso or ''
    classification = signal.ai_classification or 'unclassified'

    subject = f"[AFRO SENTINEL] {severity.upper()} — {disease} in {country}"

    body = (
        f"AFRO Sentinel Watchtower — Alert Notification\n"
        f"{'=' * 50}\n\n"
        f"Signal ID: {signal.id}\n"
        f"Disease: {disease}\n"
        f"Country: {country} ({iso3})\n"
        f"Priority: {signal.priority}\n"
        f"AI Classification: {classification}\n"
        f"AI Severity: {severity}\n"
        f"Notification Scope: {review_result.get('notification_scope', 'N/A')}\n\n"
        f"Cases: {signal.reported_cases or 'N/A'}\n"
        f"Deaths: {signal.reported_deaths or 'N/A'}\n"
        f"Cross-border Risk: {'Yes' if signal.cross_border_risk else 'No'}\n\n"
        f"AI Reasoning:\n{review_result.get('reasoning', 'N/A')}\n\n"
        f"Notify Groups:\n{review_result.get('notify_groups', 'N/A')}\n\n"
        f"View in dashboard: {getattr(settings, 'FRONTEND_BASE_URL', '')}/alerts-v2\n"
        f"{'=' * 50}\n"
        f"Generated at: {now.isoformat()}\n"
    )

    # ── Phase 1: Email ──
    email_recipients = _get_notify_emails() if email_should_fire else []
    if email_recipients:
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                recipient_list=email_recipients,
                fail_silently=False,
            )
            channels_notified.append('email')
            logger.info(
                "Email notification sent for signal %s to %d recipients",
                signal.id, len(email_recipients),
            )
        except (smtplib.SMTPException, OSError) as e:
            logger.error(
                "Email notification failed for signal %s: %s", signal.id, e,
            )

    # ── Phase 2: Telegram (Intelligence Briefing format) ──
    telegram_token = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
    telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID', '').strip()
    # Fallback to legacy env-var names if the new ones are empty
    if not telegram_token:
        telegram_token = os.getenv('ALERT_TELEGRAM_BOT_TOKEN', '').strip()
    if not telegram_chat_id:
        telegram_chat_id = os.getenv('ALERT_TELEGRAM_CHAT_ID', '').strip()

    if telegram_should_fire and telegram_token and telegram_chat_id:
        # ── 6-hour dedup: skip if we already notified for this disease+country recently ──
        should_send_telegram = True
        try:
            from sentinel.models import AgentStep
            from datetime import timedelta
            six_hours_ago = now - timedelta(hours=6)
            recent_notify = AgentStep.objects.filter(
                kind='notify',
                created_at__gte=six_hours_ago,
                output_summary__icontains='telegram',
                run__signal__disease_name=signal.disease_name,
                run__signal__location_country_iso=signal.location_country_iso,
            ).exclude(run__signal_id=signal.id).exists()
            if recent_notify:
                should_send_telegram = False
                logger.info(
                    "Telegram dedup: skipping signal %s — %s/%s already notified within 6h",
                    signal.id, signal.disease_name, signal.location_country_iso,
                )
        except _DB_ERRORS as e:
            logger.warning("Telegram dedup check failed (sending anyway): %s", e)

        if should_send_telegram:
            # ── Build Intelligence Briefing message ──
            severity_emoji = '🔴' if severity == 'critical' else '🟠'
            safe_disease = _escape_telegram_html(disease)
            safe_country = _escape_telegram_html(country)

            # Case / death / CFR line — omitted entirely when no data
            cases_val = signal.reported_cases
            deaths_val = signal.reported_deaths
            epi_parts = []
            if cases_val:
                epi_parts.append(f"{cases_val:,} cases")
            if deaths_val:
                epi_parts.append(f"{deaths_val:,} deaths")
            if cases_val and deaths_val and cases_val > 0:
                cfr = (deaths_val / cases_val) * 100
                epi_parts.append(f"CFR {cfr:.1f}%")
            epi_line = ' · '.join(epi_parts) if epi_parts else ''

            # Corroboration line — pull from the corroborate step
            corr_line = ''
            citations: list = []
            try:
                from sentinel.models import AgentRun
                latest_run = AgentRun.objects.filter(signal=signal).order_by('-started_at').first()
                if latest_run:
                    corr_step = latest_run.steps.filter(kind='corroborate').first()
                    if corr_step and corr_step.citations:
                        citations = list(corr_step.citations)
                        source_parts = []
                        for c in citations[:5]:
                            s_name = _escape_telegram_html(c.get('source_name', ''))
                            s_tier = c.get('tier', '?')
                            source_parts.append(f"{s_name} (T{s_tier})")
                        if source_parts:
                            count = len(citations)
                            corr_line = (
                                f"Verified by {count} source{'s' if count != 1 else ''}: "
                                f"{', '.join(source_parts)}"
                            )
            except _DB_ERRORS as e:
                # Corroboration footer is optional context; never block the
                # alert on an unreadable AgentStep row.
                logger.debug("corroboration footer skipped for signal %s: %s", signal.id, e)

            # Confidence — read from latest AgentRun
            confidence_val = getattr(signal, '_agent_confidence', None)
            if confidence_val is None:
                try:
                    from sentinel.models import AgentRun as _AR
                    _latest = _AR.objects.filter(signal=signal).order_by('-started_at').first()
                    if _latest and _latest.confidence:
                        confidence_val = float(_latest.confidence)
                except _DB_ERRORS as e:
                    # Confidence is decoration on the alert; missing it is fine.
                    logger.debug("confidence lookup skipped for signal %s: %s", signal.id, e)

            # Notify groups (from the LLM review step)
            notify_groups = review_result.get('notify_groups', '')
            safe_groups = _escape_telegram_html(notify_groups) if notify_groups else ''

            # Scope label
            scope = review_result.get('notification_scope', '')
            scope_label = scope.capitalize() if scope else ''

            # ── Compose the message — no wasted lines ──
            lines = []

            # Line 1: headline
            lines.append(f"{severity_emoji} <b>{severity.upper()} — {safe_disease} · {safe_country}</b>")

            # Line 2: epi numbers (only if we have data)
            if epi_line:
                lines.append(epi_line)

            # Line 3: corroboration (only if sources found)
            if corr_line:
                lines.append(f"🔗 {corr_line}")

            # Blank separator before the analyst narrative
            lines.append('')

            # Analyst narrative — composed by cloud LLM from the article + agent reasoning.
            # Wrapped here (not in _compose_alert_narrative) so any failure cannot
            # block the rest of the message from going out.
            try:
                narrative = _compose_alert_narrative(
                    signal, review_result, citations, confidence_val,
                )
                if narrative:
                    lines.append(_escape_telegram_html(narrative))
                    lines.append('')
            except _LLM_ERRORS as e:
                logger.warning("alert narrative skipped for signal %s: %s", signal.id, e)

            # Metadata: confidence + scope on one line
            meta_parts = []
            if confidence_val:
                meta_parts.append(f"Confidence {int(confidence_val * 100)}%")
            if scope_label:
                meta_parts.append(f"{scope_label} scope")
            if meta_parts:
                lines.append(' · '.join(meta_parts))

            # Recommended action (only if the LLM gave something meaningful)
            if safe_groups:
                lines.append(f"→ <i>{safe_groups}</i>")

            # Footer: thin separator + agent signature + timestamp
            lines.append('')
            lines.append(f"<code>{now.strftime('%d %b %Y, %H:%M UTC')} · WHO AFRO Intelligence Agent via PDX</code>")

            telegram_text = '\n'.join(lines)

            try:
                resp = http_requests.post(
                    f"https://api.telegram.org/bot{telegram_token}/sendMessage",
                    json={
                        'chat_id': telegram_chat_id,
                        'text': telegram_text,
                        'parse_mode': 'HTML',
                    },
                    timeout=15,
                )
                if resp.status_code == 200:
                    channels_notified.append('telegram')
                    logger.info(
                        "Telegram notification sent for signal %s", signal.id,
                    )
                else:
                    logger.warning(
                        "Telegram API returned %s for signal %s: %s",
                        resp.status_code, signal.id, resp.text[:200],
                    )
            except http_requests.RequestException as e:
                logger.error(
                    "Telegram notification failed for signal %s: %s", signal.id, e,
                )

    # ── Log notification to analyst_notes (atomic append to avoid races) ──
    if channels_notified:
        from django.db.models import Case, F, Value, When, CharField
        from django.db.models.functions import Concat, Coalesce
        from sentinel.models import Signal as _SignalModel

        channels_str = '/'.join(channels_notified)
        note = f"NOTIFICATION SENT: [{channels_str}] at {now.isoformat()}"

        # Prepend '\n' only when the existing notes are non-empty so the field
        # never starts with a stray newline. NULL and '' both collapse to the
        # bare note via Coalesce + Case.
        existing = Coalesce(F('analyst_notes'), Value(''), output_field=CharField())
        _SignalModel.objects.filter(pk=signal.pk).update(
            analyst_notes=Case(
                When(
                    analyst_notes__isnull=False,
                    analyst_notes__gt='',
                    then=Concat(existing, Value(f'\n{note}'), output_field=CharField()),
                ),
                default=Value(note),
                output_field=CharField(),
            )
        )
        signal.refresh_from_db(fields=['analyst_notes'])

        logger.info(
            "Signal %s notification logged: %s", signal.id, channels_str,
        )

    return {
        'notified': bool(channels_notified),
        'channels': channels_notified,
    }


def _get_notify_emails() -> list:
    """Read comma-separated email list from ALERT_NOTIFY_EMAILS env var."""
    raw = os.getenv('ALERT_NOTIFY_EMAILS', '').strip()
    if not raw:
        return []
    return [e.strip() for e in raw.split(',') if e.strip()]


# ── Step 4: Classify single signal (on-demand API endpoint) ──────────────

def classify_single_signal(signal, *, allow_notifications: bool = False) -> dict:
    """
    Full pipeline for a single signal (used by the /classify/ API endpoint).
    Returns the updated signal fields as a dict.

    allow_notifications: when False (default), the notify step is skipped
    even if the gates pass. Scheduler-driven runs pass False so the auto
    pipeline stays silent on Telegram/email; the manual "Run AI Analysis"
    button passes True so an analyst-triggered run can fire alerts.
    """
    from sentinel.models import AgentRunStatus

    run = _start_run(signal)
    corroboration_count = 0
    confidence = None

    try:
        # ── Step 1: Perceive ──
        t0 = time.monotonic()
        _log_step(
            run, step_number=1, kind='perceive', agent_name='Monitor',
            input_summary=f"Signal {signal.id}: {signal.disease_name or 'Unknown'} in {signal.location_country}",
            output_summary=f"Picked up SIG-{signal.id} — {signal.disease_name or 'Unknown'}, {signal.location_country}",
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

        # ── Step 2: Classify (two-pass) ──
        t0 = time.monotonic()
        two_pass = monitor_classify_two_pass(signal)
        latency_classify = int((time.monotonic() - t0) * 1000)
        pass_1 = two_pass['pass_1']
        pass_2 = two_pass['pass_2']
        agreement = two_pass['agreement']
        tentative_classification = two_pass['classification']

        cases = two_pass.get('cases')
        deaths = two_pass.get('deaths')
        if cases is not None:
            signal.reported_cases = cases
        if deaths is not None:
            signal.reported_deaths = deaths

        agreement_marker = '✓ AGREEMENT' if agreement else '✗ DISAGREEMENT'
        _log_step(
            run, step_number=2, kind='classify', agent_name='Classifier (×2)',
            input_summary=f"Signal {signal.id} text ({len(signal.original_text or '')} chars), 2 parallel passes",
            output_summary=(
                f"pass_1={pass_1['classification']} · pass_2={pass_2['classification']} · {agreement_marker}"
            ),
            reasoning=(
                f"Conservative pass: {pass_1.get('rationale', '')}\n"
                f"---\n"
                f"Vigilant pass: {pass_2.get('rationale', '')}"
            ),
            latency_ms=latency_classify,
        )

        # ── Step 3: Corroborate ──
        t0 = time.monotonic()
        corr = corroborate(signal)
        corroboration_count = corr['count']
        latency_corr = int((time.monotonic() - t0) * 1000)

        citations = [
            {
                'source_name': s['source_name'],
                'source_url': s.get('source_url'),
                'tier': s['tier'],
                'matched_at': s['matched_at'],
            }
            for s in corr['sources']
        ]
        _log_step(
            run, step_number=3, kind='corroborate', agent_name='Corroborator',
            input_summary=f"72h window, disease={signal.disease_name}, country={signal.location_country_iso}",
            output_summary=f"{corroboration_count} independent source(s) · Tier-1: {corr['tier1_count']}",
            citations=citations,
            latency_ms=latency_corr,
        )

        # ── Step 4: Debate (conditional — only on disagreement) ──
        debate_result = None
        if agreement:
            classification = tentative_classification
            confidence = _agreement_confidence(corr['tier1_count'])
        else:
            t0 = time.monotonic()
            debate_result = debate(signal, pass_1, pass_2)
            latency_debate = int((time.monotonic() - t0) * 1000)
            classification = debate_result['classification']
            confidence = debate_result['confidence']
            adj = debate_result['adjudication']
            sk = debate_result['skeptic']
            hk = debate_result['hawk']
            _log_step(
                run, step_number=4, kind='debate', agent_name='Skeptic vs Hawk · Adjudicator',
                input_summary=(
                    f"Skeptic→{sk['preferred_classification']} · Hawk→{hk['preferred_classification']}"
                ),
                output_summary=(
                    f"⚖️ Adjudicator: {classification} · conf={confidence:.2f}"
                ),
                reasoning=(
                    f"SKEPTIC ({sk['preferred_classification']}): {sk['argument']}\n"
                    f"---\n"
                    f"HAWK ({hk['preferred_classification']}): {hk['argument']}\n"
                    f"---\n"
                    f"ADJUDICATOR: {adj['ruling']}"
                ),
                latency_ms=latency_debate,
            )

        # ── Step 5: Review ──
        from sentinel.models import Signal
        t0 = time.monotonic()
        recent = list(Signal.objects.filter(
            ai_classification__isnull=False
        ).order_by('-ai_classified_at').values(
            'id', 'ai_classification', 'ai_severity', 'disease_name', 'location_country'
        )[:10])
        rev_result = review_assess(signal.id, classification, recent)
        latency_review = int((time.monotonic() - t0) * 1000)

        _log_step(
            run, step_number=5, kind='review', agent_name='Reviewer',
            input_summary=f"classification={classification} · conf={confidence:.2f} · {len(recent)} historical",
            output_summary=f"severity={rev_result.get('severity')} · scope={rev_result.get('notification_scope')}",
            reasoning=rev_result.get('reasoning', ''),
            latency_ms=latency_review,
        )

        # ── Save signal fields ──
        signal.ai_classification = classification
        signal.ai_severity = rev_result.get('severity', 'uncertain')
        signal.ai_notification_scope = rev_result.get('notification_scope', 'local')
        debate_summary = (
            f"\n---\nDebate: Skeptic→{debate_result['skeptic']['preferred_classification']} · "
            f"Hawk→{debate_result['hawk']['preferred_classification']} · "
            f"Adjudicator→{classification} (conf {confidence:.2f})"
            if debate_result else ''
        )
        signal.ai_reasoning = (
            f"Two-pass classify: pass_1={pass_1['classification']} · pass_2={pass_2['classification']} "
            f"({'AGREEMENT' if agreement else 'DISAGREEMENT'}) · final={classification} (conf {confidence:.2f})\n"
            f"---\n"
            f"Conservative: {pass_1.get('rationale', '')}\n"
            f"Vigilant: {pass_2.get('rationale', '')}"
            f"{debate_summary}\n"
            f"---\n"
            f"Review: {rev_result.get('reasoning', '')}\n"
            f"Notify: {rev_result.get('notify_groups', '')}"
        )
        signal.ai_classified_at = timezone.now()
        signal.save(update_fields=[
            'ai_classification', 'ai_severity', 'ai_notification_scope',
            'ai_reasoning', 'ai_classified_at', 'reported_cases', 'reported_deaths'
        ])

        logger.info(
            "Signal %s classified: %s / %s / %s · conf=%.2f",
            signal.id, classification, rev_result.get('severity'),
            rev_result.get('notification_scope'), confidence,
        )

        # ── Step 6: Notify (gated on confidence ≥ 0.70 AND severity ∈ {high, critical}) ──
        # Auto/scheduler runs pass allow_notifications=False so this stays silent.
        # The manual "Run AI Analysis" button passes True to actually fire.
        notify_result = {'notified': False, 'channels': []}
        severity = rev_result.get('severity', 'uncertain')
        meets_severity = severity in ('critical', 'high')
        meets_confidence = confidence is not None and confidence >= 0.70
        meets_classification = classification in ('area_alert', 'continent_alert')
        gate_passed = meets_classification and meets_severity and meets_confidence

        if gate_passed and allow_notifications:
            t0 = time.monotonic()
            notify_result = notify_officers(signal, rev_result)
            latency_notify = int((time.monotonic() - t0) * 1000)
            channels = notify_result.get('channels', [])
            _log_step(
                run, step_number=6, kind='notify', agent_name='Notifier',
                input_summary=(
                    f"gate: conf={confidence:.2f}≥0.70 ✓ · severity={severity} ∈ high/critical ✓ · manual=True"
                ),
                output_summary=(
                    f"Sent via {'/'.join(channels)}" if channels
                    else f"Skipped: {notify_result.get('reason', 'no channels configured')}"
                ),
                latency_ms=latency_notify,
            )
        elif gate_passed and not allow_notifications:
            conf_str = f"{confidence:.2f}" if confidence is not None else "N/A"
            _log_step(
                run, step_number=6, kind='notify', agent_name='Notifier',
                input_summary=(
                    f"gate: conf={conf_str} · severity={severity} ✓ · manual=False"
                ),
                output_summary='Silent observation — auto run, notifications disabled',
                latency_ms=0,
            )
        else:
            reason_bits = []
            if not meets_classification:
                reason_bits.append(f"classification={classification}")
            if not meets_severity:
                reason_bits.append(f"severity={severity}")
            if not meets_confidence:
                reason_bits.append(f"conf={confidence:.2f}<0.70" if confidence is not None else "conf=N/A")
            conf_str = f"{confidence:.2f}" if confidence is not None else "N/A"
            _log_step(
                run, step_number=6, kind='notify', agent_name='Notifier',
                input_summary=(
                    f"gate: conf={conf_str} · severity={severity}"
                ),
                output_summary=f"Silent observation — gate failed ({'; '.join(reason_bits)})",
                latency_ms=0,
            )

        # ── Step 7: Reflect — meta-reasoning consistency check (cheap, uses fallback Ollama) ──
        t0 = time.monotonic()
        reflect_result = _reflect(
            signal=signal,
            classification=classification,
            severity=rev_result.get('severity', 'uncertain'),
            confidence=confidence,
            corroboration_count=corroboration_count,
            reasoning_summary=signal.ai_reasoning or '',
        )
        latency_reflect = int((time.monotonic() - t0) * 1000)
        reflect_consistent = reflect_result.get('consistent', True)
        reflect_comment = reflect_result.get('comment', '')
        conf_str = f"{confidence:.2f}" if confidence is not None else "N/A"
        _log_step(
            run, step_number=7, kind='reflect', agent_name='Reflector',
            input_summary=f"classification={classification} · severity={rev_result.get('severity')} · conf={conf_str}",
            output_summary=(
                f"{'✓ Consistent' if reflect_consistent else '✗ Inconsistency detected'}"
                f"{(' — ' + reflect_comment) if reflect_comment else ''}"
            ),
            reasoning=reflect_comment,
            latency_ms=latency_reflect,
            model_name=reflect_result.get('model', ''),
        )

        _finish_run(run, AgentRunStatus.COMPLETED, confidence=confidence, corroboration_count=corroboration_count)

        return {
            'classification': classification,
            'severity': rev_result.get('severity'),
            'notification_scope': rev_result.get('notification_scope'),
            'reasoning': signal.ai_reasoning,
            'confidence': confidence,
            'agent_run_id': str(run.run_id),
        }

    except Exception as e:  # noqa: BLE001 — top-level wrapper: must catch anything to mark the run FAILED + re-raise
        logger.error("classify_single_signal failed for signal %s: %s", signal.id, e)
        _finish_run(run, AgentRunStatus.FAILED, error=str(e))
        raise


# ── Entry point: Batch classify new signals (called by scheduler) ────────

def classify_new_signals(limit: int = 20) -> dict:
    """
    Classify all unclassified signals. Called by APScheduler every 5 min.

    Wrapped in tenant_context('0') because APScheduler runs in-process
    (not through Django middleware), so app.current_tenant defaults to '-1'
    (deny-all). Without this, all Signal queries return 0 rows under RLS.

    Pipeline per signal:
        1. LLM classify → area_alert / continent_alert / no_alert
        2. LLM review   → severity + notification scope
        3. Save to DB
        4. Notify officers if area_alert or continent_alert
    """
    from sentinel.models import Signal, SignalStatus
    from utils.tenant_tasks import tenant_context

    with tenant_context('0'):
        unclassified = Signal.objects.filter(
            ai_classification__isnull=True,
            status__in=[SignalStatus.NEW, SignalStatus.TRIAGED, SignalStatus.VALIDATED]
        ).order_by('-created_at')[:limit]

        total = len(unclassified)
        if total == 0:
            logger.info("Agent classifier: no unclassified signals found")
            return {'classified': 0, 'total': 0}

        logger.info("Agent classifier: processing %d signals", total)

        # Get recent history for Review context (shared across batch)
        recent_history = list(Signal.objects.filter(
            ai_classification__isnull=False
        ).order_by('-ai_classified_at').values(
            'id', 'ai_classification', 'ai_severity', 'disease_name', 'location_country'
        )[:10])

        classified = 0
        for signal in unclassified:
            try:
                classify_single_signal(signal)
                classified += 1

                # Update shared history for next signal in batch
                recent_history.insert(0, {
                    'id': signal.id,
                    'ai_classification': signal.ai_classification,
                    'ai_severity': signal.ai_severity,
                    'disease_name': signal.disease_name,
                    'location_country': signal.location_country,
                })
                if len(recent_history) > 10:
                    recent_history = recent_history[:10]

            except Exception as e:  # noqa: BLE001 — batch loop: one bad signal must not abort the run over all signals
                logger.error("Classification failed for signal %s: %s", signal.id, e)

        logger.info("Agent classifier: classified %d / %d signals", classified, total)
        return {'classified': classified, 'total': total}

