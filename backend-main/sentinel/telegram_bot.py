"""
Telegram bot — inbound webhook handler for on-demand country briefings.

Hidden command flow (not registered with BotFather, must be typed):
    /country <name>      → bot replies asking for the secret key
    <Countryname>101     → bot validates, then summarises last 24h of
                            P1 signals + their AgentRun outputs for that
                            country via the cloud LLM and sends the report.

State per chat is held in Django's cache for 10 minutes.

Outbound notification path (notify_officers) lives in agent_classifier.py;
this module is read-only inbound + on-demand outbound.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import timedelta
from typing import Optional

import requests as http_requests
from django.core.cache import cache
from django.db import DatabaseError
from django.utils import timezone

from hdis.llm_client import LLMConfig, chat

logger = logging.getLogger(__name__)

# Failure modes for chat() and downstream response parsing.
_LLM_ERRORS = (
    RuntimeError,
    http_requests.RequestException,
    ValueError,
    AttributeError,
    KeyError,
    TypeError,
)

CACHE_PREFIX = 'telegram_bot:session:'
CACHE_TTL_SECONDS = 600  # 10 min for the secret prompt to expire
COUNTRY_LOOKBACK_HOURS = 24
MAX_SIGNALS_IN_PROMPT = 25
MAX_SECRET_ATTEMPTS = 3

# Reuse the same cloud LLM the agent pipeline uses.
_AGENT_LLM_CONFIG = LLMConfig.from_env(prefix='AGENT_LLM')


# ── Telegram low-level send ─────────────────────────────────────────────

def _get_token() -> str:
    return (
        os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
        or os.getenv('ALERT_TELEGRAM_BOT_TOKEN', '').strip()
    )


def _send_message(
    chat_id: int | str,
    text: str,
    parse_mode: str = 'HTML',
) -> Optional[int]:
    """Send a Telegram message. Returns the message_id on success, None on failure."""
    token = _get_token()
    if not token:
        logger.warning('telegram_bot: no token configured, dropping reply to %s', chat_id)
        return None
    try:
        resp = http_requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': parse_mode,
                'disable_web_page_preview': True,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            logger.warning(
                'telegram_bot: sendMessage %s → %s %s',
                chat_id, resp.status_code, resp.text[:200],
            )
            return None
        try:
            return int(resp.json().get('result', {}).get('message_id'))
        except (ValueError, TypeError, AttributeError):
            # Malformed/missing message_id field — caller treats None as "no pin"
            return None
    except http_requests.RequestException as e:
        logger.error('telegram_bot: sendMessage failed for %s: %s', chat_id, e)
        return None


def _pin_message(chat_id: int | str, message_id: int) -> bool:
    token = _get_token()
    if not token:
        return False
    try:
        resp = http_requests.post(
            f'https://api.telegram.org/bot{token}/pinChatMessage',
            json={
                'chat_id': chat_id,
                'message_id': message_id,
                'disable_notification': True,
            },
            timeout=15,
        )
        return resp.status_code == 200
    except http_requests.RequestException as e:
        logger.warning('telegram_bot: pin failed: %s', e)
        return False


def _unpin_message(chat_id: int | str, message_id: int) -> bool:
    token = _get_token()
    if not token:
        return False
    try:
        resp = http_requests.post(
            f'https://api.telegram.org/bot{token}/unpinChatMessage',
            json={'chat_id': chat_id, 'message_id': message_id},
            timeout=15,
        )
        return resp.status_code == 200
    except http_requests.RequestException as e:
        logger.warning('telegram_bot: unpin failed: %s', e)
        return False


def _escape_html(text: str) -> str:
    if not text:
        return ''
    return (
        text.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
    )


# ── Session state (per-chat) ────────────────────────────────────────────

def _session_key(chat_id: int | str) -> str:
    return f'{CACHE_PREFIX}{chat_id}'


def _set_state(chat_id: int | str, state: dict) -> None:
    cache.set(_session_key(chat_id), state, timeout=CACHE_TTL_SECONDS)


def _pop_state(chat_id: int | str) -> Optional[dict]:
    key = _session_key(chat_id)
    state = cache.get(key)
    if state is not None:
        cache.delete(key)
    return state


# ── Country resolution ──────────────────────────────────────────────────

def _resolve_country(name_input: str) -> Optional[dict]:
    """
    Match the user-typed country name to one we have signals for.
    Returns {'display': 'Ethiopia', 'iso3': 'ETH'} or None.

    Strategy: case-insensitive exact match against Signal.location_country
    (most recent first). Cheap and works for any country present in our data
    without maintaining a separate gazetteer.
    """
    from sentinel.models import Signal

    name = (name_input or '').strip()
    if not name:
        return None

    match = (
        Signal.objects
        .filter(location_country__iexact=name)
        .exclude(location_country__isnull=True)
        .exclude(location_country='')
        .order_by('-created_at')
        .values('location_country', 'location_country_iso')
        .first()
    )
    if not match:
        return None
    return {
        'display': match['location_country'],
        'iso3': (match['location_country_iso'] or '').upper(),
    }


def _expected_secret(country_display: str) -> str:
    # "Ethiopia" → "Ethiopia101". Strip whitespace, keep capitalisation
    # the way it is in our DB (matches what the user sees in the prompt).
    return f'{country_display.strip()}101'


# ── 24h briefing ────────────────────────────────────────────────────────

def _collect_briefing_inputs(country: dict) -> dict:
    """Pull all signals from the last 24h for this country plus their AgentRun rows."""
    from sentinel.models import Signal
    from sentinel.models_agent import AgentRun

    cutoff = timezone.now() - timedelta(hours=COUNTRY_LOOKBACK_HOURS)
    signals_qs = Signal.objects.filter(
        location_country__iexact=country['display'],
        created_at__gte=cutoff,
    ).order_by('-created_at')[:MAX_SIGNALS_IN_PROMPT]

    signals = list(signals_qs)
    signal_ids = [s.id for s in signals]

    runs_by_signal: dict[int, AgentRun] = {}
    if signal_ids:
        # Latest AgentRun per signal
        for run in (
            AgentRun.objects
            .filter(signal_id__in=signal_ids)
            .prefetch_related('steps')
            .order_by('signal_id', '-started_at')
        ):
            if run.signal_id not in runs_by_signal:
                runs_by_signal[run.signal_id] = run

    return {'signals': signals, 'runs_by_signal': runs_by_signal}


def _build_summary_prompt(country: dict, payload: dict) -> tuple[str, str]:
    signals = payload['signals']
    runs = payload['runs_by_signal']

    items = []
    for s in signals:
        run = runs.get(s.id)
        steps_text = ''
        if run:
            step_lines = []
            for step in run.steps.all():
                if not step.output_summary:
                    continue
                step_lines.append(f'    - {step.kind}: {step.output_summary[:300]}')
            if step_lines:
                steps_text = '\n  Agent reasoning:\n' + '\n'.join(step_lines)

        items.append(
            f'- Signal #{s.id} | {s.disease_name or "Unknown disease"} | '
            f'priority={s.priority} | severity={s.ai_severity or "n/a"} | '
            f'cases={s.reported_cases or "?"} deaths={s.reported_deaths or "?"} | '
            f'source={s.source_name or "?"} ({s.created_at.isoformat()})\n'
            f'  Headline: {(s.disease_name or "")} — {(s.translated_text or s.original_text or "")[:300]}'
            f'{steps_text}'
        )

    body = '\n\n'.join(items) if items else 'No P1 signals in the last 24 hours.'

    system_prompt = (
        'You are an intelligence analyst writing a concise country health-security '
        'briefing for a WHO regional officer. Use clear, factual prose. '
        'Output plain text suitable for Telegram (no markdown formatting). '
        'Keep it under 1500 characters. Use short paragraphs and dashes for lists. '
        'If there is no data, say so explicitly in one short paragraph.'
    )
    user_prompt = (
        f'Country: {country["display"]} ({country["iso3"] or "ISO?"})\n'
        f'Window: last {COUNTRY_LOOKBACK_HOURS} hours\n'
        f'All signals + agent reasoning (any priority/severity, raw feed):\n\n{body}\n\n'
        'Write the briefing now. Cover: (1) headline situation, '
        '(2) most concerning diseases / events, '
        '(3) corroboration / source quality, '
        '(4) recommended next action for the officer. '
        'If most signals are low-priority / no-alert, say so explicitly — '
        'the goal is an honest read of what crossed the wire, not just the worst items.'
    )
    return system_prompt, user_prompt


def _generate_briefing_text(country: dict) -> str:
    payload = _collect_briefing_inputs(country)
    if not payload['signals']:
        return (
            f'No signals on record for {country["display"]} in the last '
            f'{COUNTRY_LOOKBACK_HOURS} hours. Nothing to brief.'
        )

    system_prompt, user_prompt = _build_summary_prompt(country, payload)
    try:
        response = chat(
            system_prompt,
            user_prompt,
            temperature=0.3,
            max_tokens=900,
            config=_AGENT_LLM_CONFIG,
        )
        text = (response.content or '').strip()
        if not text:
            raise ValueError('empty LLM response')
        return text
    except _LLM_ERRORS as e:
        logger.error('telegram_bot: briefing LLM call failed for %s: %s', country['display'], e)
        return (
            f'Briefing generation failed for {country["display"]}. '
            f'{len(payload["signals"])} P1 signals were found in the last '
            f'{COUNTRY_LOOKBACK_HOURS}h but the summariser is unavailable. Try again shortly.'
        )


# ── Update dispatch ─────────────────────────────────────────────────────

_COUNTRY_CMD_RE = re.compile(r'^/country(?:@\w+)?(?:\s+(.+))?\s*$', re.IGNORECASE)
_BRIEFING_CMD_RE = re.compile(r'^/briefing(?:@\w+)?\s*$', re.IGNORECASE)


def _begin_country_flow(chat_id: int | str, country_arg: str) -> dict:
    """Resolve a country name and either ask for the secret or report not-found."""
    country_arg = country_arg.strip()
    country = _resolve_country(country_arg)
    if not country:
        _send_message(
            chat_id,
            f'No signals on record for "{_escape_html(country_arg)}". '
            'Check the spelling and try again.',
        )
        return {'handled': True, 'kind': 'country_unknown'}

    _set_state(chat_id, {'awaiting_secret_for': country['display']})
    _send_message(
        chat_id,
        f'Country recognised: <b>{_escape_html(country["display"])}</b>.\n'
        'Reply with the secret key to receive the 24-hour briefing.',
    )
    return {'handled': True, 'kind': 'country_prompt', 'country': country['display']}


def handle_update(update: dict) -> dict:
    """
    Entry point for a Telegram update payload (already parsed JSON).
    Returns a small dict for logging/tests; the actual reply is sent via the API.
    """
    message = update.get('message') or update.get('edited_message') or {}
    chat_id = (message.get('chat') or {}).get('id')
    text = (message.get('text') or '').strip()

    if not chat_id or not text:
        return {'handled': False, 'reason': 'no chat_id or text'}

    # ── /briefing — HDIS executive briefing on demand ──
    if _BRIEFING_CMD_RE.match(text):
        _send_message(
            chat_id,
            '👁 Looking up the latest HDIS briefing — will send the cached one '
            f'if it is under {BRIEFING_MAX_AGE_HOURS}h old, otherwise generating '
            'a fresh one. This can take up to a minute.',
        )
        try:
            briefing, was_generated = _get_or_generate_briefing()
        except (*_LLM_ERRORS, DatabaseError) as e:
            logger.exception('telegram_bot: /briefing failed: %s', e)
            _send_message(
                chat_id,
                'Briefing generation failed. Try again shortly, or check the '
                'HDIS dashboard.',
            )
            return {'handled': True, 'kind': 'briefing_failed'}

        if was_generated:
            _send_message(chat_id, '✅ Fresh briefing generated. Sending now...')
        else:
            age_min = int((timezone.now() - briefing.generated_at).total_seconds() // 60)
            _send_message(
                chat_id,
                f'📦 Reusing cached briefing ({age_min} min old). Sending now...',
            )

        formatted = _format_briefing_for_telegram(briefing)
        _send_long_message(chat_id, formatted)
        return {'handled': True, 'kind': 'briefing_sent', 'fresh': was_generated}

    # ── /country [name] command ──
    cmd_match = _COUNTRY_CMD_RE.match(text)
    if cmd_match:
        country_arg = (cmd_match.group(1) or '').strip()
        if not country_arg:
            # Tapped /country from the menu — wait for the country name next.
            _set_state(chat_id, {'awaiting_country': True})
            _send_message(
                chat_id,
                'Which country? Reply with the name '
                '(e.g. <code>Ethiopia</code>).',
            )
            return {'handled': True, 'kind': 'country_awaiting_name'}
        return _begin_country_flow(chat_id, country_arg)

    # ── Awaiting country name (after bare /country tap)? ──
    state = _pop_state(chat_id)
    if state and state.get('awaiting_country'):
        return _begin_country_flow(chat_id, text)

    # ── Awaiting secret? ──
    if state and state.get('awaiting_secret_for'):
        pending_country = state['awaiting_secret_for']
        attempts = int(state.get('attempts', 0))
        expected = _expected_secret(pending_country)
        if text.strip() != expected:
            attempts += 1
            if attempts >= MAX_SECRET_ATTEMPTS:
                _send_message(
                    chat_id,
                    f'Incorrect secret ({MAX_SECRET_ATTEMPTS} attempts used). '
                    'Start over with <code>/country</code>.',
                )
                return {'handled': True, 'kind': 'secret_bad_final'}
            # Re-arm the same pending state so the user can retry.
            _set_state(chat_id, {
                'awaiting_secret_for': pending_country,
                'attempts': attempts,
            })
            remaining = MAX_SECRET_ATTEMPTS - attempts
            _send_message(
                chat_id,
                f'Incorrect secret. Try again ({remaining} attempt'
                f'{"s" if remaining != 1 else ""} left).',
            )
            return {'handled': True, 'kind': 'secret_bad', 'attempts': attempts}

        country = _resolve_country(pending_country) or {
            'display': pending_country, 'iso3': '',
        }
        _send_message(
            chat_id,
            f'👁 Secret confirmed. Pulling the last {COUNTRY_LOOKBACK_HOURS}h of '
            f'signals for <b>{_escape_html(country["display"])}</b> and running '
            'the analyst summary — I will message you the briefing as soon as it is ready.',
        )
        briefing = _generate_briefing_text(country)
        # Briefing goes as plain text (the prompt asked the LLM not to use markup).
        _send_message(chat_id, _escape_html(briefing))
        return {'handled': True, 'kind': 'briefing_sent', 'country': country['display']}

    # ── Anything else: ignore silently ──
    return {'handled': False, 'reason': 'no matching state'}


# ── /briefing — HDIS executive briefing on demand ───────────────────────

BRIEFING_MAX_AGE_HOURS = 6  # reuse a briefing if it was generated within this window
TELEGRAM_MESSAGE_LIMIT = 3800  # leave headroom under the 4096 hard cap


def _format_briefing_for_telegram(briefing) -> str:
    """Turn an HDIS Briefing into a Telegram-friendly HTML string."""
    content = briefing.content or {}
    scope_label = (briefing.country_iso or briefing.get_scope_display() or 'Global').strip()

    parts: list[str] = []
    parts.append(
        f"📋 <b>HDIS Executive Briefing — {_escape_html(scope_label)}</b>"
    )
    parts.append(
        f"<i>Generated {briefing.generated_at.strftime('%d %b %Y %H:%M UTC')} · "
        f"{briefing.signal_count} signals · {briefing.source_count} sources · "
        f"confidence {briefing.confidence_level}</i>"
    )
    parts.append('')

    summary = (content.get('executive_summary') or '').strip()
    if summary:
        parts.append('<b>Executive summary</b>')
        parts.append(_escape_html(summary))
        parts.append('')

    risk = content.get('risk_assessment') or {}
    if isinstance(risk, dict):
        level = (risk.get('overall_level') or '').strip()
        key_risks = risk.get('key_risks') or []
        if level or key_risks:
            parts.append('<b>Risk assessment</b>')
            if level:
                parts.append(f'Overall: <b>{_escape_html(level)}</b>')
            for r in key_risks[:5]:
                if isinstance(r, dict):
                    label = r.get('risk') or r.get('label') or ''
                    detail = r.get('detail') or r.get('description') or ''
                    line = f"• {_escape_html(label)}"
                    if detail:
                        line += f" — {_escape_html(detail)}"
                    parts.append(line)
                elif isinstance(r, str):
                    parts.append(f"• {_escape_html(r)}")
            parts.append('')

    cross = (content.get('cross_pillar_correlation') or '').strip()
    if cross:
        parts.append('<b>Cross-pillar correlation</b>')
        parts.append(_escape_html(cross))
        parts.append('')

    actions = content.get('recommended_actions') or []
    if actions:
        parts.append('<b>Recommended actions</b>')
        for a in actions[:6]:
            if isinstance(a, dict):
                pri = (a.get('priority') or '').upper()
                act = a.get('action') or a.get('text') or ''
                pri_tag = f"[{_escape_html(pri)}] " if pri else ''
                parts.append(f"• {pri_tag}{_escape_html(act)}")
            elif isinstance(a, str):
                parts.append(f"• {_escape_html(a)}")
        parts.append('')

    gaps = content.get('information_gaps') or []
    if gaps:
        parts.append('<b>Information gaps</b>')
        for g in gaps[:4]:
            if isinstance(g, dict):
                parts.append(f"• {_escape_html(g.get('gap') or g.get('text') or '')}")
            elif isinstance(g, str):
                parts.append(f"• {_escape_html(g)}")
        parts.append('')

    return '\n'.join(parts).rstrip()


def _send_long_message(chat_id, text: str) -> None:
    """Telegram caps sendMessage at 4096 chars — split on blank lines if needed."""
    if len(text) <= TELEGRAM_MESSAGE_LIMIT:
        _send_message(chat_id, text)
        return

    chunks: list[str] = []
    current = ''
    for para in text.split('\n\n'):
        candidate = (current + '\n\n' + para) if current else para
        if len(candidate) > TELEGRAM_MESSAGE_LIMIT:
            if current:
                chunks.append(current)
            # If a single paragraph is itself too long, hard-truncate it.
            if len(para) > TELEGRAM_MESSAGE_LIMIT:
                chunks.append(para[:TELEGRAM_MESSAGE_LIMIT - 20] + '\n…(truncated)')
                current = ''
            else:
                current = para
        else:
            current = candidate
    if current:
        chunks.append(current)

    for i, chunk in enumerate(chunks):
        suffix = f"\n\n<i>(part {i + 1}/{len(chunks)})</i>" if len(chunks) > 1 else ''
        _send_message(chat_id, chunk + suffix)


def _get_or_generate_briefing():
    """
    Return the most recent HDIS briefing if one was generated within the last
    BRIEFING_MAX_AGE_HOURS. Otherwise generate a fresh daily_global briefing
    and return it.
    """
    from hdis.models import Briefing
    from hdis.briefing_engine import generate_briefing

    cutoff = timezone.now() - timedelta(hours=BRIEFING_MAX_AGE_HOURS)
    latest = (
        Briefing.objects
        .filter(scope='daily_global', generated_at__gte=cutoff)
        .order_by('-generated_at')
        .first()
    )
    if latest:
        return latest, False  # reused

    fresh = generate_briefing(scope='daily_global')
    return fresh, True  # newly generated


# ── Hourly status ping (pinned, auto-rotated) ───────────────────────────

HOURLY_LOOKBACK_HOURS = 1
PIN_CACHE_KEY = 'telegram_bot:hourly_pin_message_id'


def _build_hourly_summary() -> str:
    """Build a short human-readable status of what the agent did in the last hour."""
    from sentinel.models import Signal

    cutoff = timezone.now() - timedelta(hours=HOURLY_LOOKBACK_HOURS)

    classified_qs = Signal.objects.filter(ai_classified_at__gte=cutoff)
    total_classified = classified_qs.count()

    by_classification = {
        'area_alert': classified_qs.filter(ai_classification='area_alert').count(),
        'continent_alert': classified_qs.filter(ai_classification='continent_alert').count(),
        'no_alert': classified_qs.filter(ai_classification='no_alert').count(),
        'uncertain': classified_qs.filter(ai_classification='uncertain').count(),
    }
    by_severity = {
        'critical': classified_qs.filter(ai_severity='critical').count(),
        'high': classified_qs.filter(ai_severity='high').count(),
        'moderate': classified_qs.filter(ai_severity='moderate').count(),
        'low': classified_qs.filter(ai_severity='low').count(),
    }

    # Top 3 disease/country pairs in the alert-worthy bucket
    alertable = (
        classified_qs
        .filter(ai_classification__in=['area_alert', 'continent_alert'])
        .filter(ai_severity__in=['critical', 'high'])
        .values('disease_name', 'location_country')
        .order_by('-ai_classified_at')[:3]
    )
    hot_lines = [
        f"• {(row['disease_name'] or 'Unknown').strip()} — "
        f"{(row['location_country'] or 'Unknown').strip()}"
        for row in alertable
    ]

    now = timezone.now()
    lines = [
        f"📡 <b>Hourly Watchtower Status</b> · {now.strftime('%d %b %H:%M UTC')}",
        '',
        f"Signals classified in the last {HOURLY_LOOKBACK_HOURS}h: <b>{total_classified}</b>",
    ]
    if total_classified:
        lines.append(
            f"Classification — area: {by_classification['area_alert']} · "
            f"continent: {by_classification['continent_alert']} · "
            f"no-alert: {by_classification['no_alert']} · "
            f"uncertain: {by_classification['uncertain']}"
        )
        lines.append(
            f"Severity — critical: {by_severity['critical']} · "
            f"high: {by_severity['high']} · "
            f"moderate: {by_severity['moderate']} · "
            f"low: {by_severity['low']}"
        )
        if hot_lines:
            lines.append('')
            lines.append('<i>Most recent alert-worthy:</i>')
            lines.extend(hot_lines)
        else:
            lines.append('')
            lines.append('<i>No alert-worthy signals this window.</i>')
    else:
        lines.append('<i>Quiet hour — nothing new went through the classifier.</i>')

    return '\n'.join(lines)


def send_hourly_status() -> dict:
    """
    Compose + send + pin the hourly status. Called by the scheduler.
    Unpins the previous hourly pin so only one is ever pinned at a time.

    Wrapped in tenant_context('0') because APScheduler runs in-process
    (not through middleware), so app.current_tenant defaults to '-1'
    (deny-all). The Signal queries in _build_hourly_summary() need
    cross-tenant access.

    Kill switch: set DISABLE_AGENT_NOTIFICATIONS=1 to suppress the hourly
    pin (same env var that gates the per-signal alerts in notify_officers).
    """
    if os.getenv('DISABLE_AGENT_NOTIFICATIONS', '').strip() in ('1', 'true', 'yes', 'on'):
        logger.info('telegram_bot: hourly status skipped — DISABLE_AGENT_NOTIFICATIONS is set')
        return {'sent': False, 'reason': 'disabled_by_env'}

    from utils.tenant_tasks import tenant_context

    with tenant_context('0'):
        chat_id = (
            os.getenv('TELEGRAM_CHAT_ID', '').strip()
            or os.getenv('ALERT_TELEGRAM_CHAT_ID', '').strip()
        )
        token = _get_token()
        if not chat_id or not token:
            logger.info('telegram_bot: hourly status skipped — token/chat_id missing')
            return {'sent': False, 'reason': 'not configured'}

        text = _build_hourly_summary()
        new_msg_id = _send_message(chat_id, text)
        if not new_msg_id:
            return {'sent': False, 'reason': 'send failed'}

        # Unpin the previous hourly pin (if any) before pinning the new one,
        # otherwise the chat accumulates a stack of pinned status messages.
        prev_msg_id = cache.get(PIN_CACHE_KEY)
        if prev_msg_id:
            _unpin_message(chat_id, int(prev_msg_id))

        pinned = _pin_message(chat_id, new_msg_id)
        if pinned:
            # Keep for ~2h so a missed scheduler tick doesn't lose the reference.
            cache.set(PIN_CACHE_KEY, new_msg_id, timeout=7200)

        return {'sent': True, 'message_id': new_msg_id, 'pinned': pinned}


def handle_update_json(raw_body: bytes | str) -> dict:
    try:
        if isinstance(raw_body, (bytes, bytearray)):
            raw_body = raw_body.decode('utf-8')
        update = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError, AttributeError) as e:
        logger.warning('telegram_bot: bad JSON payload: %s', e)
        return {'handled': False, 'reason': 'bad json'}
    return handle_update(update)
