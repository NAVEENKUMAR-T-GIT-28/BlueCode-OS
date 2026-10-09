from collections.abc import Callable

from app.config import Settings, get_settings
from app.core.budget import BudgetGate
from app.db import get_engine
from app.llm.client import LLMClient
from app.llm.providers import AnthropicProvider, OllamaProvider, OpenAIProvider, Provider


def build_provider(s: Settings) -> Provider:
    if s.llm_provider == "openai":
        return OpenAIProvider(
            api_key=s.openai_api_key, base_url=s.openai_base_url,
            timeout=s.llm_timeout_seconds, send_temperature=s.openai_send_temperature,
        )
    if s.llm_provider == "anthropic":
        return AnthropicProvider(
            api_key=s.anthropic_api_key, base_url=s.anthropic_base_url,
            timeout=s.llm_timeout_seconds,
        )
    return OllamaProvider(base_url=s.ollama_base_url, timeout=s.ollama_timeout_seconds)


def get_llm_client() -> LLMClient:
    """FastAPI dependency. Raises LLMConfigError if the chosen provider is not configured."""
    s = get_settings()
    return LLMClient(build_provider(s), BudgetGate(get_engine()), s)


def get_llm_factory() -> Callable[[], LLMClient]:
    """FastAPI dependency returning a builder, so a missing key can be handled by the
    endpoint (e.g. fall back to manual entry) instead of failing at injection time."""
    return get_llm_client
