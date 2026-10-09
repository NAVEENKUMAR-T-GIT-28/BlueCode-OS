"""LLM provider adapters: OpenAI, Anthropic, Ollama (local).

All three expose the same method and map failures to the same exceptions:
    TransientError   timeouts, connection errors, HTTP 429 / 5xx   (worth retrying)
    LLMConfigError   bad or missing API key, unknown model          (operator must fix)
    LLMError         any other rejection of the request
They use plain HTTP (httpx) rather than vendor SDKs, so switching provider is a config change.
"""
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.errors import LLMConfigError, LLMError, TransientError


@dataclass(frozen=True)
class LLMResult:
    text: str
    input_tokens: int
    output_tokens: int


class Provider(Protocol):
    name: str
    is_free: bool  # True for local models: calls cost nothing but still pass the budget gate

    def complete(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
    ) -> LLMResult: ...


def _post(
    *,
    provider: str,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout: float,
    transport: httpx.BaseTransport | None,
) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=timeout, transport=transport) as client:
            resp = client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise TransientError(f"{provider} timed out") from exc
    except httpx.TransportError as exc:
        raise TransientError(f"Could not reach {provider}") from exc

    if resp.status_code == 429 or resp.status_code >= 500:
        raise TransientError(f"{provider} is busy or unavailable (HTTP {resp.status_code})")
    if resp.status_code in (401, 403):
        raise LLMConfigError(f"{provider} rejected the API key (HTTP {resp.status_code})")
    if resp.status_code == 404:
        raise LLMConfigError(f"{provider} could not find the endpoint or model (HTTP 404)")
    if resp.status_code >= 400:
        raise LLMError(f"{provider} rejected the request (HTTP {resp.status_code}): {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise LLMError(f"{provider} returned a non-JSON response") from exc


class OpenAIProvider:
    name = "openai"
    is_free = False

    def __init__(self, *, api_key: str, base_url: str, timeout: float,
                 send_temperature: bool = True, transport: httpx.BaseTransport | None = None):
        if not api_key:
            raise LLMConfigError("OPENAI_API_KEY is not set")
        self.api_key, self.base_url, self.timeout = api_key, base_url.rstrip("/"), timeout
        self.send_temperature, self.transport = send_temperature, transport

    def complete(self, *, system, messages, model, max_tokens, temperature) -> LLMResult:
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "system", "content": system}, *messages],
            "max_completion_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        if self.send_temperature:
            payload["temperature"] = temperature
        data = _post(
            provider="OpenAI", url=f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            payload=payload, timeout=self.timeout, transport=self.transport,
        )
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("OpenAI response had an unexpected shape") from exc
        usage = data.get("usage") or {}
        return LLMResult(text, int(usage.get("prompt_tokens", 0)),
                         int(usage.get("completion_tokens", 0)))


class AnthropicProvider:
    name = "anthropic"
    is_free = False

    def __init__(self, *, api_key: str, base_url: str, timeout: float,
                 transport: httpx.BaseTransport | None = None):
        if not api_key:
            raise LLMConfigError("ANTHROPIC_API_KEY is not set")
        self.api_key, self.base_url, self.timeout = api_key, base_url.rstrip("/"), timeout
        self.transport = transport

    def complete(self, *, system, messages, model, max_tokens, temperature) -> LLMResult:
        data = _post(
            provider="Anthropic", url=f"{self.base_url}/v1/messages",
            headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
            payload={"model": model, "max_tokens": max_tokens, "temperature": temperature,
                     "system": system, "messages": messages},
            timeout=self.timeout, transport=self.transport,
        )
        blocks = data.get("content")
        if not isinstance(blocks, list):
            raise LLMError("Anthropic response had an unexpected shape")
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        usage = data.get("usage") or {}
        return LLMResult(text, int(usage.get("input_tokens", 0)),
                         int(usage.get("output_tokens", 0)))


class OllamaProvider:
    name = "ollama"
    is_free = True

    def __init__(self, *, base_url: str, timeout: float,
                 transport: httpx.BaseTransport | None = None):
        self.base_url, self.timeout, self.transport = base_url.rstrip("/"), timeout, transport

    def complete(self, *, system, messages, model, max_tokens, temperature) -> LLMResult:
        data = _post(
            provider="Ollama", url=f"{self.base_url}/api/chat", headers={},
            payload={
                "model": model,
                "messages": [{"role": "system", "content": system}, *messages],
                "stream": False,
                "format": "json",
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
            timeout=self.timeout, transport=self.transport,
        )
        try:
            text = data["message"]["content"] or ""
        except (KeyError, TypeError) as exc:
            raise LLMError("Ollama response had an unexpected shape") from exc
        return LLMResult(text, int(data.get("prompt_eval_count", 0)),
                         int(data.get("eval_count", 0)))
