"""
Outbreak LLM config (T-121).

Wraps `hdis.llm_client.LLMConfig` with an outbreak-specific env prefix so
the workspace can target a different model/endpoint from the sentinel
classifier. Defaults to a locally running Ollama with Llama 3.1 8b; later
we just flip the env vars to point at the Johannesburg cloud endpoint and
no code changes are required.

ENV VARS:
    OUTBREAK_LLM_PROVIDER  = ollama | openai | azure_openai | gemini   (default: ollama)
    OUTBREAK_LLM_MODEL     = model name                                 (default: llama3.1:8b)
    OUTBREAK_LLM_BASE_URL  = http://localhost:11434                     (Ollama endpoint)
    OUTBREAK_LLM_API_KEY   = sk-... or empty for Ollama
    OUTBREAK_LLM_TIMEOUT   = 240
"""

import os
import logging

from hdis.llm_client import LLMConfig

logger = logging.getLogger(__name__)

OUTBREAK_LLM_PREFIX = 'OUTBREAK_LLM'

# Conservative defaults for an 8b model — context window is ~8k tokens.
DEFAULT_MAX_INPUT_TOKENS = 3500
DEFAULT_MAX_OUTPUT_TOKENS = 800
DEFAULT_TEMPERATURE = 0.15


def get_outbreak_llm_config() -> LLMConfig:
    """
    Build the outbreak LLM config from env. Falls back to llama3.1:8b on
    local Ollama if no env vars are set. Logs the resolved endpoint at
    INFO so misconfiguration is visible.
    """
    # Ensure Llama 3.1 8b is the default if no model override is set.
    if not os.getenv(f'{OUTBREAK_LLM_PREFIX}_MODEL'):
        os.environ[f'{OUTBREAK_LLM_PREFIX}_MODEL'] = 'llama3.1:8b'

    cfg = LLMConfig.from_env(prefix=OUTBREAK_LLM_PREFIX)
    logger.info(
        "[outbreak-llm] provider=%s model=%s base_url=%s",
        cfg.provider, cfg.model, cfg.base_url,
    )
    return cfg
