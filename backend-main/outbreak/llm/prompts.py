"""
Outbreak LLM prompts (T-123, T-127).

Hard rule: every claim must cite. No data → "no data". No improvisation.
The pathogen-aware system prompt pulls clinical guardrails from
pathogen.profile_json.llm_clinical_notes when present.
"""

from typing import Optional


BASE_SYSTEM_PROMPT = (
    "You are an outbreak intelligence analyst for the WHO AFRO region. "
    "You answer ONLY from the structured data block provided below. "
    "Every factual claim MUST be followed by a citation tag in square "
    "brackets:\n"
    "  [evt:<id>]  for an OutbreakEvent line in the data\n"
    "  [cap:<key>] for a Capacity field (composite, readiness, ihr, chw, spillover, star)\n"
    "  [path:<field>] for a Pathogen profile field\n"
    "If the answer is not present in the data, respond with the exact "
    "string: `no data`. Do not infer, do not improvise, do not invent "
    "citations. Lives may depend on accuracy."
)


def build_system_prompt(
    pathogen_name: str = '',
    clinical_notes: Optional[list] = None,
) -> str:
    """
    Compose the system prompt. If the pathogen profile contains
    `llm_clinical_notes` (a list of strings), append them as
    pathogen-specific guardrails.
    """
    parts = [BASE_SYSTEM_PROMPT]
    if pathogen_name:
        parts.append(f"\nPathogen in scope: {pathogen_name}.")
    if clinical_notes:
        parts.append("\nPathogen-specific guardrails (apply when relevant):")
        for note in clinical_notes:
            parts.append(f"- {note}")
    return '\n'.join(parts)


def build_user_prompt(grounding: str, question: str) -> str:
    """
    The user prompt frames the data block first, the question last.
    Recency bias in 8b-model attention favors the most recent tokens.
    """
    return (
        f"=== DATA ===\n{grounding}\n=== END DATA ===\n\n"
        f"Question: {question}\n\n"
        "Answer using only the data above. Cite every fact. If the data "
        "does not contain the answer, respond exactly with: no data"
    )


def build_sitrep_prompt(grounding: str, template_fields: list) -> str:
    """Prompt for daily sitrep generation."""
    fields_text = '\n'.join(f"- {f}" for f in template_fields)
    return (
        f"=== DATA ===\n{grounding}\n=== END DATA ===\n\n"
        "Draft a concise daily situation report covering ONLY the "
        "following sections, using ONLY the data above. Cite every "
        "claim with [evt:N], [cap:KEY] or [path:FIELD]. If a section "
        "has no supporting data, write `no data`.\n\n"
        f"Sections:\n{fields_text}"
    )
