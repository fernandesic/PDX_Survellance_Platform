"""
LLM Client — Provider-agnostic abstraction layer with resilience.

Features:
    - Multi-provider support (Ollama, OpenAI, Azure OpenAI, Gemini)
    - Exponential backoff retry (3 attempts)
    - Circuit breaker (auto-trips after consecutive failures, resets after cooldown)
    - Provider fallback chain (e.g. Gemini → OpenAI → Ollama)
    - Token usage tracking and latency logging

ENV VARS:
    LLM_PROVIDER        = ollama | openai | azure_openai | gemini   (default: ollama)
    LLM_MODEL           = model name                                (default: llama3.2:1b)
    LLM_BASE_URL        = http://localhost:11434                    (Ollama endpoint)
    LLM_API_KEY          = sk-... or Google API key                  (blank for Ollama)
    LLM_TIMEOUT          = 240                                       (seconds per call)

    LLM_FALLBACK_PROVIDER = ollama                   (fallback when primary fails)
    LLM_FALLBACK_MODEL    = llama3.2:1b                 (fallback model)
    LLM_FALLBACK_BASE_URL = http://localhost:11434   (fallback endpoint)
    LLM_FALLBACK_API_KEY  =                          (fallback API key)

    LLM_RETRY_ATTEMPTS    = 3                        (max retries per provider)
    LLM_CIRCUIT_COOLDOWN  = 300                      (seconds before retry after circuit trips)

    # Azure OpenAI specific
    AZURE_OPENAI_ENDPOINT  = https://your-resource.openai.azure.com/
    AZURE_OPENAI_API_KEY   = ...
    AZURE_OPENAI_API_VERSION = 2024-02-15-preview
    AZURE_OPENAI_DEPLOYMENT = gpt-4o
"""

import json
import logging
import os
import time
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Configuration ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LLMConfig:
    """Immutable LLM configuration read from environment."""
    provider: str
    model: str
    base_url: str
    api_key: str
    timeout: int

    @classmethod
    def from_env(cls, prefix: str = "LLM") -> "LLMConfig":
        return cls(
            provider=os.getenv(f"{prefix}_PROVIDER", "ollama"),
            model=os.getenv(f"{prefix}_MODEL", "llama3.2:1b"),
            base_url=os.getenv(f"{prefix}_BASE_URL", "http://localhost:11434"),
            api_key=os.getenv(f"{prefix}_API_KEY", ""),
            timeout=int(os.getenv(f"{prefix}_TIMEOUT", "120")),
        )

    @classmethod
    def fallback_from_env(cls) -> Optional["LLMConfig"]:
        """Load fallback config, returns None if not configured."""
        provider = os.getenv("LLM_FALLBACK_PROVIDER", "")
        if not provider:
            return None
        return cls(
            provider=provider,
            model=os.getenv("LLM_FALLBACK_MODEL", "llama3.2:1b"),
            base_url=os.getenv("LLM_FALLBACK_BASE_URL", "http://localhost:11434"),
            api_key=os.getenv("LLM_FALLBACK_API_KEY", ""),
            timeout=int(os.getenv("LLM_FALLBACK_TIMEOUT", "120")),
        )


# ── Response ─────────────────────────────────────────────────────────────

@dataclass
class LLMResponse:
    """Standardized response from any LLM provider."""
    content: str
    model: str
    provider: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    raw: Dict[str, Any] = field(default_factory=dict)
    used_fallback: bool = False

    def as_json(self) -> Optional[Dict[str, Any]]:
        """
        Attempt to parse response content as JSON.
        Returns None if parsing fails.
        """
        try:
            # Strip markdown fences if present
            text = self.content.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                # Remove first and last lines (```json and ```)
                lines = [l for l in lines[1:] if not l.strip().startswith("```")]
                text = "\n".join(lines)
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            logger.warning("LLM response is not valid JSON: %s...", self.content[:200])
            return None


# ── Circuit Breaker ──────────────────────────────────────────────────────

class CircuitBreaker:
    """
    Simple circuit breaker for LLM providers.
    
    States:
        CLOSED  → Normal operation, requests pass through.
        OPEN    → Provider has failed repeatedly, requests short-circuit to fallback.
        
    After cooldown_seconds, the breaker moves to HALF-OPEN:
        - One request is allowed through to test the provider.
        - If it succeeds → CLOSED (reset).
        - If it fails → OPEN (restart cooldown).
    """
    
    CLOSED = 'closed'
    OPEN = 'open'
    
    def __init__(self, failure_threshold: int = 3, cooldown_seconds: int = 300):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._lock = threading.Lock()
    
    @property
    def state(self) -> str:
        with self._lock:
            if self._state == self.OPEN:
                # Check if cooldown has elapsed → move to half-open
                elapsed = time.monotonic() - self._last_failure_time
                if elapsed >= self.cooldown_seconds:
                    return 'half-open'
            return self._state

    def is_available(self) -> bool:
        """True if requests should be attempted against this provider."""
        return self.state != self.OPEN
    
    def record_success(self):
        """Reset the breaker on success."""
        with self._lock:
            self._failure_count = 0
            self._state = self.CLOSED
    
    def record_failure(self):
        """Record a failure and potentially trip the breaker."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._failure_count >= self.failure_threshold:
                self._state = self.OPEN
                logger.warning(
                    "[CircuitBreaker] TRIPPED after %d consecutive failures. "
                    "Cooldown: %ds", self._failure_count, self.cooldown_seconds,
                )
    
    def reset(self):
        """Force-reset the breaker."""
        with self._lock:
            self._failure_count = 0
            self._state = self.CLOSED
            self._last_failure_time = 0.0


# Per-provider circuit breakers (module-level singletons)
_circuit_breakers: Dict[str, CircuitBreaker] = {}
_cb_lock = threading.Lock()


def _get_circuit_breaker(provider: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a provider."""
    with _cb_lock:
        if provider not in _circuit_breakers:
            cooldown = int(os.getenv("LLM_CIRCUIT_COOLDOWN", "300"))
            _circuit_breakers[provider] = CircuitBreaker(
                failure_threshold=3, cooldown_seconds=cooldown,
            )
        return _circuit_breakers[provider]


# ── Provider Backends ────────────────────────────────────────────────────

def _call_ollama(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
) -> LLMResponse:
    """Call Ollama REST API (/api/chat)."""
    import requests

    payload = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    start = time.monotonic()
    resp = requests.post(
        f"{config.base_url}/api/chat",
        json=payload,
        timeout=config.timeout,
    )
    latency_ms = int((time.monotonic() - start) * 1000)
    resp.raise_for_status()

    data = resp.json()
    content = data.get("message", {}).get("content", "")

    return LLMResponse(
        content=content,
        model=config.model,
        provider="ollama",
        prompt_tokens=data.get("prompt_eval_count", 0),
        completion_tokens=data.get("eval_count", 0),
        latency_ms=latency_ms,
        raw=data,
    )


def _is_reasoning_model(model: str) -> bool:
    """Models that reject temperature and use max_completion_tokens: o-series + gpt-5.x."""
    import re
    return bool(re.match(r"^o\d|^gpt-5", model))


def _call_openai(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
) -> LLMResponse:
    """Call OpenAI-compatible API."""
    import requests

    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/json",
    }

    reasoning = _is_reasoning_model(config.model)
    payload: Dict[str, Any] = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if reasoning:
        # o-series models: no temperature, tokens param is max_completion_tokens
        payload["max_completion_tokens"] = max_tokens
    else:
        payload["temperature"] = temperature
        payload["max_tokens"] = max_tokens

    base = config.base_url.rstrip("/")
    url = f"{base}/v1/chat/completions" if "openai" not in base else f"{base}/chat/completions"

    start = time.monotonic()
    resp = requests.post(url, json=payload, headers=headers, timeout=config.timeout)
    latency_ms = int((time.monotonic() - start) * 1000)
    resp.raise_for_status()

    data = resp.json()
    choice = data.get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    usage = data.get("usage", {})

    return LLMResponse(
        content=content,
        model=config.model,
        provider="openai",
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        latency_ms=latency_ms,
        raw=data,
    )


def _call_azure_openai(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
) -> LLMResponse:
    """Call Azure OpenAI API."""
    import requests

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", config.base_url).rstrip("/")
    api_key = os.getenv("AZURE_OPENAI_API_KEY", config.api_key)
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", config.model)

    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"

    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    start = time.monotonic()
    resp = requests.post(url, json=payload, headers=headers, timeout=config.timeout)
    latency_ms = int((time.monotonic() - start) * 1000)
    resp.raise_for_status()

    data = resp.json()
    choice = data.get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    usage = data.get("usage", {})

    return LLMResponse(
        content=content,
        model=deployment,
        provider="azure_openai",
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        latency_ms=latency_ms,
        raw=data,
    )


def _call_gemini(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
) -> LLMResponse:
    """Call Google Gemini API."""
    import requests

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{config.model}:generateContent?key={config.api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }

    start = time.monotonic()
    resp = requests.post(url, json=payload, timeout=config.timeout)
    latency_ms = int((time.monotonic() - start) * 1000)
    resp.raise_for_status()

    data = resp.json()
    candidates = data.get("candidates", [])
    content = ""
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        content = parts[0].get("text", "") if parts else ""

    usage = data.get("usageMetadata", {})

    return LLMResponse(
        content=content,
        model=config.model,
        provider="gemini",
        prompt_tokens=usage.get("promptTokenCount", 0),
        completion_tokens=usage.get("candidatesTokenCount", 0),
        latency_ms=latency_ms,
        raw=data,
    )


# ── Provider Registry ────────────────────────────────────────────────────

_PROVIDERS = {
    "ollama": _call_ollama,
    "openai": _call_openai,
    "azure_openai": _call_azure_openai,
    "gemini": _call_gemini,
}


# ── Retry with Exponential Backoff ───────────────────────────────────────

def _call_with_retry(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    max_attempts: int = 3,
) -> LLMResponse:
    """
    Call a provider with exponential backoff retry.
    Raises the last exception if all attempts fail.
    """
    provider_fn = _PROVIDERS.get(config.provider)
    if provider_fn is None:
        raise ValueError(
            f"Unknown LLM provider: '{config.provider}'. "
            f"Supported: {list(_PROVIDERS.keys())}"
        )

    cb = _get_circuit_breaker(config.provider)
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = provider_fn(config, system_prompt, user_prompt, temperature, max_tokens)
            cb.record_success()
            return response
        except Exception as e:  # noqa: BLE001 — retry/circuit-breaker layer: wraps arbitrary provider exceptions
            last_error = e
            cb.record_failure()

            if attempt < max_attempts:
                # Exponential backoff: 2s, 4s, 8s...
                delay = 2 ** attempt
                logger.warning(
                    "[LLM] %s attempt %d/%d failed: %s — retrying in %ds",
                    config.provider, attempt, max_attempts, str(e)[:200], delay,
                )
                time.sleep(delay)
            else:
                logger.error(
                    "[LLM] %s FAILED all %d attempts. Last error: %s",
                    config.provider, max_attempts, str(e)[:200],
                )

    raise last_error


# ── Public Interface ─────────────────────────────────────────────────────

def chat(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    config: Optional[LLMConfig] = None,
    retry_on_json_fail: bool = False,
) -> LLMResponse:
    """
    Send a chat completion request to the configured LLM provider.
    
    Resilience chain:
        1. Try primary provider with exponential backoff (3 attempts)
        2. If circuit breaker trips or all retries fail → try fallback provider
        3. If fallback also fails → raise exception

    Args:
        system_prompt:      The system/instruction prompt.
        user_prompt:        The user/data prompt.
        temperature:        Creativity dial (0.0 = deterministic, 1.0 = creative).
        max_tokens:         Max response length.
        config:             Override config (defaults to from_env()).
        retry_on_json_fail: If True and response is not valid JSON,
                            retry once with a correction prompt.

    Returns:
        LLMResponse with content, token usage, latency, and fallback flag.
    """
    if config is None:
        config = LLMConfig.from_env()

    max_attempts = max(1, int(os.getenv("LLM_RETRY_ATTEMPTS", "3")))
    response = None
    used_fallback = False

    # ── Try primary provider ──
    cb = _get_circuit_breaker(config.provider)

    if cb.is_available():
        try:
            logger.info(
                "[LLM] provider=%s model=%s temp=%.1f max_tokens=%d",
                config.provider, config.model, temperature, max_tokens,
            )
            response = _call_with_retry(
                config, system_prompt, user_prompt, temperature, max_tokens,
                max_attempts=max_attempts,
            )
        except Exception as e:  # noqa: BLE001 — primary-provider boundary: any failure must fall through to fallback
            logger.error("[LLM] Primary provider %s exhausted: %s", config.provider, str(e)[:200])
    else:
        logger.warning(
            "[LLM] Circuit breaker OPEN for %s — skipping to fallback", config.provider,
        )

    # ── Try fallback provider ──
    if response is None:
        fallback_config = LLMConfig.fallback_from_env()
        if fallback_config and fallback_config.provider != config.provider:
            try:
                logger.info(
                    "[LLM] FALLBACK → provider=%s model=%s",
                    fallback_config.provider, fallback_config.model,
                )
                response = _call_with_retry(
                    fallback_config, system_prompt, user_prompt,
                    temperature, max_tokens, max_attempts=2,
                )
                used_fallback = True
            except Exception as e:  # noqa: BLE001 — fallback-provider boundary: any failure must raise the combined error below
                logger.error(
                    "[LLM] Fallback provider %s also failed: %s",
                    fallback_config.provider, str(e)[:200],
                )
                raise RuntimeError(
                    f"All LLM providers failed. "
                    f"Primary: {config.provider} ({config.model}), "
                    f"Fallback: {fallback_config.provider} ({fallback_config.model})"
                ) from e
        elif response is None:
            raise RuntimeError(
                f"LLM provider {config.provider} failed and no fallback configured. "
                f"Set LLM_FALLBACK_PROVIDER to enable automatic failover."
            )

    response.used_fallback = used_fallback

    logger.info(
        "[LLM] Done in %dms — provider=%s model=%s prompt_tokens=%d "
        "completion_tokens=%d fallback=%s",
        response.latency_ms, response.provider, response.model,
        response.prompt_tokens, response.completion_tokens, used_fallback,
    )

    # Retry if JSON was expected but not produced
    if retry_on_json_fail and response.as_json() is None:
        logger.warning("[LLM] JSON parse failed — retrying with correction prompt")
        correction = (
            "Your previous response was not valid JSON. "
            "Please respond with ONLY a valid JSON object, no markdown fences, "
            "no explanation text, just the raw JSON."
        )
        # Use whichever provider succeeded
        active_config = (
            LLMConfig.fallback_from_env() if used_fallback else config
        )
        try:
            response = _call_with_retry(
                active_config, system_prompt,
                f"{user_prompt}\n\n{correction}",
                temperature, max_tokens,
                max_attempts=2,
            )
            response.used_fallback = used_fallback
        except Exception as e:  # noqa: BLE001 — JSON-correction retry: any failure means fall back to the original (non-JSON) response
            logger.debug("[LLM] JSON-correction retry failed; keeping original response: %s", e)

    return response


def chat_json(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    config: Optional[LLMConfig] = None,
) -> Optional[Dict[str, Any]]:
    """
    Convenience wrapper: call LLM and parse response as JSON.
    Returns the parsed dict or None if JSON parsing fails after retry.
    """
    response = chat(
        system_prompt,
        user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        config=config,
        retry_on_json_fail=True,
    )
    return response.as_json()
