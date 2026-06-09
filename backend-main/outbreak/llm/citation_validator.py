"""
Citation validator — "Cite or Die" (T-123).

Every LLM answer must consist of claims followed by citation tags that
resolve to real items in the grounding context. Unresolved citations
mean the model invented something — we drop the response.

Tags:
    [evt:<id>]    -> integer ID matching an OutbreakEvent in the context
    [cap:<key>]   -> one of composite|readiness|ihr|chw|spillover|star
    [path:<key>]  -> a pathogen profile field name we put in the context
"""

import re
from dataclasses import dataclass
from typing import Iterable

EVT_RE = re.compile(r'\[evt:(\d+)\]')
CAP_RE = re.compile(r'\[cap:([a-zA-Z0-9_]+)\]')
PATH_RE = re.compile(r'\[path:([a-zA-Z0-9_.]+)\]')

NO_DATA_TOKEN = 'no data'

CAP_KEYS = {'composite', 'readiness', 'ihr', 'chw', 'spillover', 'star'}


@dataclass
class CitationContext:
    """Snapshot of what the LLM was allowed to cite from."""
    event_ids: set
    cap_keys: set
    path_fields: set

    @classmethod
    def from_grounding(
        cls,
        event_ids: Iterable[int],
        cap_keys: Iterable[str],
        path_fields: Iterable[str],
    ) -> 'CitationContext':
        return cls(
            event_ids={int(e) for e in event_ids},
            cap_keys={k.lower() for k in cap_keys},
            path_fields={f.lower() for f in path_fields},
        )


@dataclass
class ValidationResult:
    ok: bool
    answer: str
    reason: str = ''
    invalid_citations: list = None  # list[str]
    matched_event_ids: list = None  # list[int]
    matched_cap_keys: list = None
    matched_path_fields: list = None

    def to_response(self) -> dict:
        if self.ok:
            return {
                'answer': self.answer,
                'reason': None,
                'matched': {
                    'event_ids': sorted(self.matched_event_ids or []),
                    'cap_keys': sorted(self.matched_cap_keys or []),
                    'path_fields': sorted(self.matched_path_fields or []),
                },
            }
        return {
            'answer': None,
            'reason': self.reason,
            'invalid_citations': self.invalid_citations or [],
        }


def validate(
    raw: str,
    ctx: CitationContext,
    *,
    require_citation: bool = True,
) -> ValidationResult:
    """
    Validate an LLM response.

    Returns ValidationResult.ok=True only if every citation resolves to a
    real item in `ctx`. The literal "no data" response always passes.
    """
    text = (raw or '').strip()

    if not text:
        return ValidationResult(
            ok=False, answer='', reason='empty_response',
        )

    # The model is allowed (in fact required) to say "no data" when no
    # grounding supports the answer.
    if text.lower() == NO_DATA_TOKEN:
        return ValidationResult(ok=True, answer=NO_DATA_TOKEN, reason='no_data_acknowledged')

    evt_ids = [int(m) for m in EVT_RE.findall(text)]
    cap_keys = [m.lower() for m in CAP_RE.findall(text)]
    path_fields = [m.lower() for m in PATH_RE.findall(text)]

    invalid: list = []
    for eid in evt_ids:
        if eid not in ctx.event_ids:
            invalid.append(f'evt:{eid}')
    for key in cap_keys:
        # Allow any cap key the model produced as long as it's a known top-level
        # bucket AND was present in the grounding the caller actually shipped.
        if key not in CAP_KEYS or key not in ctx.cap_keys:
            invalid.append(f'cap:{key}')
    for field in path_fields:
        # path fields are matched permissively — exact OR prefix on a known field
        ok = False
        for known in ctx.path_fields:
            if field == known or field.startswith(known + '.') or known.startswith(field + '.'):
                ok = True
                break
        if not ok:
            invalid.append(f'path:{field}')

    if invalid:
        return ValidationResult(
            ok=False,
            answer='',
            reason='unresolved_citations',
            invalid_citations=invalid,
        )

    if require_citation and not (evt_ids or cap_keys or path_fields):
        # Model produced free-form text without citing anything.
        return ValidationResult(
            ok=False,
            answer='',
            reason='no_citations_in_response',
        )

    return ValidationResult(
        ok=True,
        answer=text,
        matched_event_ids=evt_ids,
        matched_cap_keys=cap_keys,
        matched_path_fields=path_fields,
    )
