"""LLMClient: provider-agnostic structured generation with budget control.

Every call: reserve budget -> call provider (one retry on transient errors) ->
parse + validate JSON (one repair attempt) -> settle the ACTUAL token cost.
Tokens spent on an unusable answer are still charged, because they were still spent.
"""
import json
import logging
import math
import re
import time
import uuid
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.core.budget import BudgetGate
from app.core.errors import LLMConfigError, LLMOutputError, TransientError
from app.llm.providers import LLMResult, Provider

log = logging.getLogger("app.llm")

Tier = Literal["fast", "quality"]


@dataclass(frozen=True)
class StructuredResult[T]:
    data: T
    input_tokens: int
    output_tokens: int
    cost_minor: int
    provider: str
    model: str


def wrap_untrusted(label: str, text: str) -> str:
    """Delimit third-party text so the prompt can tell the model it is data, not instructions."""
    cleaned = text.replace(f"</{label}>", "")
    return f"<{label}>\n{cleaned}\n</{label}>"


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / 3)  # deliberately pessimistic (about 4 chars/token in English)


def extract_json_object(text: str) -> dict:
    """Parse a JSON object from a model reply, tolerating code fences and surrounding prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("no JSON object found in the reply") from None
        try:
            obj = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSON: {exc.msg}") from exc
    if not isinstance(obj, dict):
        raise ValueError("the reply must be a JSON object")
    return obj


class LLMClient:
    def __init__(self, provider: Provider, gate: BudgetGate, settings: Settings,
                 retry_delay_seconds: float = 1.0):
        self.provider, self.gate, self.settings = provider, gate, settings
        self.retry_delay_seconds = retry_delay_seconds

    # ---- cost -------------------------------------------------------------------
    def cost_minor(self, input_tokens: int, output_tokens: int) -> int:
        if self.provider.is_free:
            return 0
        s = self.settings
        usd = (input_tokens * s.llm_price_input_usd_per_mtok
               + output_tokens * s.llm_price_output_usd_per_mtok) / 1_000_000
        return math.ceil(usd * s.usd_inr_rate * 100)

    def _model(self, tier: Tier) -> str:
        model = self.settings.llm_model_fast if tier == "fast" else self.settings.llm_model_quality
        if not model:
            name = "LLM_MODEL_FAST" if tier == "fast" else "LLM_MODEL_QUALITY"
            raise LLMConfigError(f"{name} is not set")
        return model

    # ---- provider call with one retry ---------------------------------------------
    def _complete(self, **kwargs) -> LLMResult:
        try:
            return self.provider.complete(**kwargs)
        except TransientError:
            time.sleep(self.retry_delay_seconds)
            return self.provider.complete(**kwargs)

    # ---- public API ---------------------------------------------------------------
    def generate_structured[T: BaseModel](
        self,
        *,
        startup_id: uuid.UUID | str,
        task: str,
        schema: type[T],
        system: str,
        user: str,
        tier: Tier = "fast",
        temperature: float = 0.0,
        max_tokens: int | None = None,
        counters: dict[str, int] | None = None,
    ) -> StructuredResult[T]:
        model = self._model(tier)
        max_tokens = max_tokens or self.settings.llm_max_output_tokens
        in_est = estimate_tokens(system + user)
        # Budget for the worst case: first attempt plus one repair attempt.
        estimate = self.cost_minor(2 * in_est + max_tokens, 2 * max_tokens)

        messages: list[dict[str, str]] = [{"role": "user", "content": user}]
        tokens_in = tokens_out = 0
        parsed: T | None = None
        error: Exception | None = None

        with self.gate.reservation(startup_id, estimate) as reservation:
            try:
                for attempt in (1, 2):
                    result = self._complete(
                        system=system, messages=messages, model=model,
                        max_tokens=max_tokens, temperature=temperature,
                    )
                    tokens_in += result.input_tokens
                    tokens_out += result.output_tokens
                    try:
                        parsed = schema.model_validate(extract_json_object(result.text))
                        break
                    except (ValueError, ValidationError) as exc:
                        log.warning("task=%s attempt=%d invalid output: %s", task, attempt,
                                    str(exc)[:200])
                        if attempt == 2:
                            raise LLMOutputError(
                                "The model did not return usable structured output"
                            ) from exc
                        messages += [
                            {"role": "assistant", "content": result.text[:4000]},
                            {"role": "user", "content": (
                                f"That reply was not valid: {str(exc)[:300]}. Reply again with "
                                "ONLY a single JSON object that matches the requested schema."
                            )},
                        ]
            except (TransientError, LLMOutputError) as exc:
                error = exc
            cost = self.cost_minor(tokens_in, tokens_out)
            reservation.set_actual(cost, counters if parsed is not None else None)

        if error is not None:
            raise error
        assert parsed is not None
        log.info("task=%s provider=%s model=%s tokens_in=%d tokens_out=%d cost_paise=%d",
                 task, self.provider.name, model, tokens_in, tokens_out, cost)
        return StructuredResult(parsed, tokens_in, tokens_out, cost, self.provider.name, model)
