import uuid

from fastapi.testclient import TestClient

from app.config import Settings
from app.core.budget import BudgetGate
from app.db import get_engine
from app.llm.client import LLMClient
from app.llm.factory import get_llm_factory
from app.main import app


def signup(prefix: str = "user") -> tuple[TestClient, dict]:
    client = TestClient(app)
    r = client.post("/api/v1/auth/signup", json={
        "startup_name": f"{prefix} Inc",
        "email": f"{prefix}-{uuid.uuid4().hex[:8]}@tenant-test.com",
        "password": "correct-horse-battery",
    })
    assert r.status_code == 201, r.text
    return client, r.json()


def llm_settings(**kw) -> Settings:
    base = dict(llm_model_fast="fast-model", llm_model_quality="quality-model",
                llm_price_input_usd_per_mtok=3.0, llm_price_output_usd_per_mtok=15.0,
                usd_inr_rate=85.0, llm_max_output_tokens=500)
    return Settings(**{**base, **kw})


def use_provider(provider) -> None:
    """Route every LLM call in the API to a scripted provider."""
    client = LLMClient(provider, BudgetGate(get_engine()), llm_settings(), retry_delay_seconds=0)
    app.dependency_overrides[get_llm_factory] = lambda: (lambda: client)


def use_factory(factory) -> None:
    app.dependency_overrides[get_llm_factory] = lambda: factory
