import math

import pytest
from pydantic import BaseModel
from sqlalchemy import text

from app.config import Settings
from app.core.budget import BudgetGate, TrialExpired
from app.core.errors import (
    BudgetExceeded,
    LLMConfigError,
    LLMOutputError,
    TransientError,
)
from app.llm.client import LLMClient
from tests.conftest import seed_tenant
from tests.llm.fakes import FakeProvider, ok

# 1000 in + 500 out at $3 / $15 per Mtok and Rs 85 per USD: 0.0105 USD = 89.25 paise -> 90
COST_1000_500 = 90


class Out(BaseModel):
    n: int


def make_settings(**kw) -> Settings:
    base = dict(llm_model_fast="fast-model", llm_model_quality="quality-model",
                llm_price_input_usd_per_mtok=3.0, llm_price_output_usd_per_mtok=15.0,
                usd_inr_rate=85.0, llm_max_output_tokens=500)
    return Settings(**{**base, **kw})


@pytest.fixture
def tenant(owner_engine):
    return seed_tenant(owner_engine)


def client_for(provider, app_engine, **settings):
    return LLMClient(provider, BudgetGate(app_engine), make_settings(**settings),
                     retry_delay_seconds=0)


def run(client, tenant, **kw):
    return client.generate_structured(startup_id=tenant["startup"], task="t", schema=Out,
                                      system="Return JSON.", user="n=1", **kw)


def usage(owner_engine, sid):
    with owner_engine.connect() as c:
        return c.execute(text("SELECT * FROM usage_tracker WHERE startup_id=:i"),
                         {"i": sid}).mappings().one()


def test_cost_formula_per_provider(app_engine):
    paid = client_for(FakeProvider([]), app_engine)
    assert paid.cost_minor(1000, 500) == COST_1000_500
    assert paid.cost_minor(0, 0) == 0
    local = client_for(FakeProvider([], is_free=True), app_engine)
    assert local.cost_minor(10_000_000, 10_000_000) == 0


def test_happy_path_charges_actual_tokens(app_engine, owner_engine, tenant):
    c = client_for(FakeProvider([ok('{"n": 7}')]), app_engine)
    result = run(c, tenant, counters={"messages_generated": 1})
    assert result.data.n == 7 and result.cost_minor == COST_1000_500
    u = usage(owner_engine, tenant["startup"])
    assert (u["spent_minor"], u["reserved_minor"], u["messages_generated"]) == (COST_1000_500, 0, 1)


def test_tier_selects_the_model(app_engine, tenant):
    p = FakeProvider([ok('{"n": 1}'), ok('{"n": 1}')])
    c = client_for(p, app_engine)
    run(c, tenant, tier="fast")
    run(c, tenant, tier="quality")
    assert [call["model"] for call in p.calls] == ["fast-model", "quality-model"]


def test_code_fenced_json_is_accepted(app_engine, tenant):
    c = client_for(FakeProvider([ok('Here you go:\n```json\n{"n": 3}\n```')]), app_engine)
    assert run(c, tenant).data.n == 3


def test_invalid_output_gets_one_repair_attempt(app_engine, owner_engine, tenant):
    p = FakeProvider([ok("sorry, I cannot"), ok('{"n": 5}')])
    result = run(client_for(p, app_engine), tenant)
    assert result.data.n == 5 and len(p.calls) == 2
    roles = [m["role"] for m in p.calls[1]["messages"]]
    assert roles == ["user", "assistant", "user"]  # repair carries the bad answer + guidance
    assert usage(owner_engine, tenant["startup"])["spent_minor"] == math.ceil(
        (2000 * 3 + 1000 * 15) / 1e6 * 85 * 100)  # both attempts are charged


def test_unusable_output_after_repair_raises_but_tokens_are_charged(app_engine, owner_engine, tenant):
    p = FakeProvider([ok('{"n": "abc"}'), ok("still wrong")])
    with pytest.raises(LLMOutputError):
        run(client_for(p, app_engine), tenant, counters={"messages_generated": 1})
    u = usage(owner_engine, tenant["startup"])
    assert u["spent_minor"] > 0 and u["reserved_minor"] == 0
    assert u["messages_generated"] == 0  # no counter bump for a failed generation


def test_one_transient_failure_is_retried(app_engine, tenant):
    p = FakeProvider([TransientError("busy"), ok('{"n": 2}')])
    assert run(client_for(p, app_engine), tenant).data.n == 2 and len(p.calls) == 2


def test_persistent_transient_failure_costs_nothing(app_engine, owner_engine, tenant):
    p = FakeProvider([TransientError("busy"), TransientError("busy")])
    with pytest.raises(TransientError):
        run(client_for(p, app_engine), tenant)
    u = usage(owner_engine, tenant["startup"])
    assert (u["spent_minor"], u["reserved_minor"]) == (0, 0)


def test_budget_exhausted_blocks_before_calling_the_provider(app_engine, owner_engine, tenant):
    with owner_engine.begin() as c:
        c.execute(text("UPDATE usage_tracker SET cap_minor = 5 WHERE startup_id=:i"),
                  {"i": tenant["startup"]})
    p = FakeProvider([ok('{"n": 1}')])
    with pytest.raises(BudgetExceeded):
        run(client_for(p, app_engine), tenant)
    assert p.calls == []


def test_local_model_is_free_but_respects_trial_expiry(app_engine, owner_engine, tenant):
    p = FakeProvider([ok('{"n": 1}'), ok('{"n": 1}')], is_free=True)
    c = client_for(p, app_engine)
    assert run(c, tenant).cost_minor == 0
    assert usage(owner_engine, tenant["startup"])["spent_minor"] == 0
    with owner_engine.begin() as conn:
        conn.execute(text("UPDATE startups SET trial_ends_at = now() - interval '1 day' WHERE id=:i"),
                     {"i": tenant["startup"]})
    with pytest.raises(TrialExpired):
        run(c, tenant)
    assert len(p.calls) == 1


def test_missing_model_fails_before_reserving(app_engine, owner_engine, tenant):
    c = client_for(FakeProvider([]), app_engine, llm_model_quality="")
    with pytest.raises(LLMConfigError, match="LLM_MODEL_QUALITY"):
        run(c, tenant, tier="quality")
    assert usage(owner_engine, tenant["startup"])["reserved_minor"] == 0


def test_provider_config_error_releases_the_reservation(app_engine, owner_engine, tenant):
    p = FakeProvider([LLMConfigError("API key rejected")])
    with pytest.raises(LLMConfigError):
        run(client_for(p, app_engine), tenant)
    u = usage(owner_engine, tenant["startup"])
    assert (u["spent_minor"], u["reserved_minor"]) == (0, 0)
