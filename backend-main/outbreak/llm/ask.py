"""
Q&A entry point (T-032, T-126).

Pipeline:
    1. Route to a canned query if the question matches one — deterministic.
    2. Otherwise: build grounding -> call LLM -> validate citations -> log.

Every call writes an LlmInteraction row for safety audit (T-128).
"""

import logging
import time
from typing import Optional

import requests

from django.db import DatabaseError

from hdis.llm_client import chat as llm_chat

from outbreak.llm import canned_queries
from outbreak.llm.citation_validator import validate
from outbreak.llm.config import (
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_TEMPERATURE,
    get_outbreak_llm_config,
)
from outbreak.llm.grounding import build_grounding
from outbreak.llm.prompts import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)

# LlmInteraction audit-log inserts go through Django ORM. We catch DB write
# errors specifically so the audit-write itself never breaks the response.
_AUDIT_ERRORS = (DatabaseError, AttributeError, ValueError, TypeError)

# Failure modes for the LLM call itself (RuntimeError from hdis.llm_client
# + transport errors).
_LLM_ERRORS = (
    RuntimeError,
    requests.RequestException,
    ValueError,
    AttributeError,
    KeyError,
    TypeError,
)


def ask(outbreak, question: str, *, source: str = 'ask') -> dict:
    """
    Answer a question about the outbreak. Returns a dict shaped like:
        {answer: str|None, reason: str|None, source: 'canned'|'llm',
         citations: list, canned_query: str|None}

    The LlmInteraction audit row is written regardless of outcome.
    """
    from outbreak.models import LlmInteraction

    question = (question or '').strip()
    if not question:
        return {
            'answer': None,
            'reason': 'empty_question',
            'source': 'router',
            'citations': [],
        }

    # 1. Canned-query short-circuit.
    canned_name = canned_queries.route(question)
    if canned_name:
        fn = canned_queries.CANNED.get(canned_name)
        if fn is not None:
            t0 = time.monotonic()
            result = fn(outbreak)
            latency = int((time.monotonic() - t0) * 1000)
            answer = result.get('answer')
            refusal_reason = '' if answer and answer != 'no data' else result.get('reason') or 'no_data'
            try:
                LlmInteraction.objects.create(
                    outbreak=outbreak,
                    source=source,
                    question=question,
                    grounding_summary='canned',
                    raw_response=str(result),
                    final_answer=answer or '',
                    refusal_reason=refusal_reason,
                    citations_matched={'citations': result.get('citations') or []},
                    canned_query=canned_name,
                    model='canned',
                    provider='canned',
                    latency_ms=latency,
                )
            except _AUDIT_ERRORS:  # pragma: no cover - audit log must not break
                logger.exception("Failed to write LlmInteraction (canned)")
            return {
                'answer': answer,
                'reason': refusal_reason or None,
                'source': 'canned',
                'citations': result.get('citations') or [],
                'canned_query': canned_name,
                'value': result.get('value'),
            }

    # 2. Generate via LLM with grounding.
    grounding = build_grounding(outbreak)
    system_prompt = build_system_prompt(
        pathogen_name=grounding.pathogen_name,
        clinical_notes=grounding.clinical_notes,
    )
    user_prompt = build_user_prompt(grounding.text, question)

    cfg = get_outbreak_llm_config()
    t0 = time.monotonic()
    try:
        resp = llm_chat(
            system_prompt,
            user_prompt,
            temperature=DEFAULT_TEMPERATURE,
            max_tokens=DEFAULT_MAX_OUTPUT_TOKENS,
            config=cfg,
        )
        raw = resp.content
        provider = resp.provider
        model = resp.model
        latency = resp.latency_ms or int((time.monotonic() - t0) * 1000)
        prompt_tokens = resp.prompt_tokens
        completion_tokens = resp.completion_tokens
    except _LLM_ERRORS as e:
        logger.exception("LLM call failed for outbreak %s", outbreak.id)
        try:
            LlmInteraction.objects.create(
                outbreak=outbreak,
                source=source,
                question=question,
                grounding_summary=grounding.text[:4000],
                raw_response='',
                final_answer='',
                refusal_reason=f'llm_error:{str(e)[:80]}',
                model=cfg.model,
                provider=cfg.provider,
                latency_ms=int((time.monotonic() - t0) * 1000),
            )
        except _AUDIT_ERRORS:  # pragma: no cover
            logger.exception("Failed to write LlmInteraction (llm-error)")
        return {
            'answer': None,
            'reason': 'llm_unavailable',
            'source': 'llm',
            'citations': [],
        }

    # 3. Validate citations.
    validation = validate(raw, grounding.citation_ctx)
    if validation.ok:
        result = {
            'answer': validation.answer,
            'reason': None,
            'source': 'llm',
            'citations': (
                [f'evt:{i}' for i in (validation.matched_event_ids or [])]
                + [f'cap:{k}' for k in (validation.matched_cap_keys or [])]
                + [f'path:{f}' for f in (validation.matched_path_fields or [])]
            ),
        }
        refusal_reason = ''
    else:
        result = {
            'answer': None,
            'reason': validation.reason,
            'source': 'llm',
            'invalid_citations': validation.invalid_citations or [],
            'citations': [],
        }
        refusal_reason = validation.reason

    try:
        LlmInteraction.objects.create(
            outbreak=outbreak,
            source=source,
            question=question,
            grounding_summary=grounding.text[:4000],
            raw_response=raw,
            final_answer=result.get('answer') or '',
            refusal_reason=refusal_reason,
            citations_matched={
                'event_ids': validation.matched_event_ids or [],
                'cap_keys': validation.matched_cap_keys or [],
                'path_fields': validation.matched_path_fields or [],
                'invalid': validation.invalid_citations or [],
            },
            model=model,
            provider=provider,
            latency_ms=latency,
            prompt_tokens=prompt_tokens or 0,
            completion_tokens=completion_tokens or 0,
        )
    except _AUDIT_ERRORS:  # pragma: no cover
        logger.exception("Failed to write LlmInteraction (llm-success/refusal)")

    return result
