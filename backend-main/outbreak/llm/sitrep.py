"""
Daily sitrep generation (T-033 / T-124).

Pulls the full grounding context (same as Q&A), asks the LLM for a
structured sitrep against a fixed template, validates citations, then
persists the result as an OutbreakDecision (kind=sitrep). Telegram
dispatch is intentionally out of scope here (T-125 deferred).
"""

import logging
import time

import requests

from hdis.llm_client import chat as llm_chat

# LLM failure modes — see outbreak/llm/ask.py for the same pattern.
_LLM_ERRORS = (
    RuntimeError,
    requests.RequestException,
    ValueError,
    AttributeError,
    KeyError,
    TypeError,
)

from outbreak.llm.citation_validator import validate
from outbreak.llm.config import get_outbreak_llm_config
from outbreak.llm.grounding import build_grounding
from outbreak.llm.prompts import build_sitrep_prompt, build_system_prompt

logger = logging.getLogger(__name__)


DEFAULT_TEMPLATE = [
    'situation_summary',
    'key_numbers',
    'capacity_gaps',
    'trends',
    'recommended_actions',
    'data_sources_cited',
]


def generate_sitrep(outbreak) -> dict:
    """
    Build and validate one sitrep for `outbreak`. Returns:
      {ok: bool, decision_id: int|None, reason: str|None, answer: str}
    """
    from outbreak.models import LlmInteraction, OutbreakDecision

    profile = outbreak.pathogen.profile_json or {}
    template_fields = profile.get('sitrep_template') or DEFAULT_TEMPLATE

    grounding = build_grounding(outbreak, max_events=25)
    system_prompt = build_system_prompt(
        pathogen_name=grounding.pathogen_name,
        clinical_notes=grounding.clinical_notes,
    )
    user_prompt = build_sitrep_prompt(grounding.text, template_fields)

    cfg = get_outbreak_llm_config()
    t0 = time.monotonic()

    try:
        resp = llm_chat(
            system_prompt,
            user_prompt,
            temperature=0.1,
            max_tokens=1200,
            config=cfg,
        )
    except _LLM_ERRORS as e:
        logger.exception("Sitrep LLM call failed for outbreak %s", outbreak.id)
        LlmInteraction.objects.create(
            outbreak=outbreak,
            source='sitrep',
            question='[sitrep]',
            grounding_summary=grounding.text[:4000],
            refusal_reason=f'llm_error:{str(e)[:80]}',
            model=cfg.model,
            provider=cfg.provider,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
        return {'ok': False, 'reason': 'llm_unavailable', 'decision_id': None, 'answer': ''}

    validation = validate(
        resp.content, grounding.citation_ctx, require_citation=True,
    )

    LlmInteraction.objects.create(
        outbreak=outbreak,
        source='sitrep',
        question='[sitrep]',
        grounding_summary=grounding.text[:4000],
        raw_response=resp.content,
        final_answer=validation.answer if validation.ok else '',
        refusal_reason='' if validation.ok else validation.reason,
        citations_matched={
            'event_ids': validation.matched_event_ids or [],
            'cap_keys': validation.matched_cap_keys or [],
            'path_fields': validation.matched_path_fields or [],
            'invalid': validation.invalid_citations or [],
        },
        model=resp.model,
        provider=resp.provider,
        latency_ms=resp.latency_ms,
        prompt_tokens=resp.prompt_tokens or 0,
        completion_tokens=resp.completion_tokens or 0,
    )

    if not validation.ok:
        return {
            'ok': False,
            'reason': validation.reason,
            'decision_id': None,
            'answer': '',
        }

    citations = (
        [f'evt:{i}' for i in (validation.matched_event_ids or [])]
        + [f'cap:{k}' for k in (validation.matched_cap_keys or [])]
        + [f'path:{f}' for f in (validation.matched_path_fields or [])]
    )

    decision = OutbreakDecision.objects.create(
        outbreak=outbreak,
        kind=OutbreakDecision.Kind.SITREP,
        title=f"Daily sitrep — {outbreak.pathogen.name} ({outbreak.iso3})",
        body=validation.answer,
        author='llm:auto',
        evidence_event_ids=validation.matched_event_ids or [],
        citations=citations,
    )

    return {
        'ok': True,
        'reason': None,
        'decision_id': decision.id,
        'answer': validation.answer,
    }
