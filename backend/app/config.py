from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

from pathlib import Path

_DEV_SECRET = "dev-only-change-me"  # noqa: S105
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(_ROOT_ENV, "../.env", ".env"), extra="ignore")

    app_env: str = "development"  # development | test | production
    jwt_secret: str = _DEV_SECRET
    jwt_expire_minutes: int = 720
    cookie_secure: bool | None = None  # defaults to True in production

    # Runtime roles (RLS applies to both). Migrations use MIGRATION_DATABASE_URL separately.
    database_url: str = "postgresql://app_user:app_pass@localhost:5432/founder_os"
    worker_database_url: str = "postgresql://worker_user:worker_pass@localhost:5432/founder_os"
    migration_database_url: str = "postgresql://postgres:naveen@localhost:5432/Bluecode-DB"

    # Plan and budget
    trial_days: int = 15
    trial_cap_minor: int = 100_000  # Rs 1,000 in paise

    # Secrets at rest: 32 random bytes, base64 encoded (python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())")
    app_encryption_key: str = ""

    # ICP limit for the pilot plan
    max_icps: int = 1

    # LLM: the platform operator picks ONE provider with LLM_PROVIDER.
    llm_provider: Literal["openai", "anthropic", "ollama"] = "openai"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_send_temperature: bool = True  # set false for models that reject a temperature value
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com"
    ollama_base_url: str = "http://ollama:11434"
    llm_model_fast: str = ""  # scoring, classification
    llm_model_quality: str = ""  # ICP parsing, outreach copy
    llm_timeout_seconds: float = 30.0
    ollama_timeout_seconds: float = 180.0  # local models are slower, especially on CPU
    llm_max_output_tokens: int = 1500
    # Cost model for the budget gate (ignored for ollama, which is always 0).
    # Placeholders: set these to the real per-million-token prices of your chosen model.
    llm_price_input_usd_per_mtok: float = 3.0
    llm_price_output_usd_per_mtok: float = 15.0
    usd_inr_rate: float = 85.0

    # Worker
    worker_poll_seconds: float = 2.0
    job_heartbeat_seconds: float = 30.0
    job_stale_seconds: int = 300
    max_running_jobs_per_startup: int = 2

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    def validate_for_runtime(self) -> None:
        if self.is_production and (self.jwt_secret == _DEV_SECRET or len(self.jwt_secret) < 32):
            raise RuntimeError("JWT_SECRET must be set to a random string of 32+ characters")


@lru_cache
def get_settings() -> Settings:
    return Settings()
