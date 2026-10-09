"""Test harness.

Needs a Postgres SUPERUSER connection (TEST_ADMIN_URL) to create a throwaway
database and the two runtime roles. The application under test then connects as
app_user / worker_user, exactly like production, so Row-Level Security applies.

    export TEST_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres
    pytest
"""
import base64
import os
import re
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ADMIN_URL = os.environ.get(
    "TEST_ADMIN_URL", "postgresql://postgres:postgres@localhost:5432/postgres"
)
TEST_DB = "founder_os_test"
APP_PASSWORD = "app_pass"
WORKER_PASSWORD = "worker_pass"


def _url(**changes) -> str:
    return make_url(ADMIN_URL).set(**changes).render_as_string(hide_password=False)


OWNER_URL = _url(database=TEST_DB)
APP_URL = _url(database=TEST_DB, username="app_user", password=APP_PASSWORD)
WORKER_URL = _url(database=TEST_DB, username="worker_user", password=WORKER_PASSWORD)

# Must be set BEFORE the app package is imported anywhere.
os.environ.update(
    APP_ENV="test",
    COOKIE_SECURE="false",
    JWT_SECRET="test-secret-test-secret-test-secret-123",
    DATABASE_URL=APP_URL,
    WORKER_DATABASE_URL=WORKER_URL,
    MIGRATION_DATABASE_URL=OWNER_URL,
    JOB_HEARTBEAT_SECONDS="1",
    APP_ENCRYPTION_KEY=base64.b64encode(b"0123456789abcdef0123456789abcdef").decode(),
)


@pytest.fixture(scope="session", autouse=True)
def database():
    admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
        c.execute(text(f"CREATE DATABASE {TEST_DB}"))
        for role, pw in (("app_user", APP_PASSWORD), ("worker_user", WORKER_PASSWORD)):
            exists = c.execute(
                text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": role}
            ).first()
            if not exists:
                c.execute(
                    text(
                        f"CREATE ROLE {role} LOGIN PASSWORD '{pw}' "
                        "NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE"
                    )
                )

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(cfg, "head")
    yield
    admin.dispose()


@pytest.fixture(scope="session")
def owner_engine(database):
    """Superuser/owner connection. Bypasses RLS. Used ONLY to seed and inspect data."""
    engine = create_engine(OWNER_URL)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def app_engine(database):
    from app.db import get_engine

    return get_engine()


@pytest.fixture(scope="session")
def worker_engine(database):
    from app.db import get_worker_engine

    return get_worker_engine()


@pytest.fixture(autouse=True)
def _reset_throttles():
    from app.auth.throttle import email_throttle, ip_throttle

    email_throttle.reset()
    ip_throttle.reset()


@pytest.fixture
def empty_jobs(owner_engine):
    with owner_engine.begin() as c:
        c.execute(text("TRUNCATE jobs"))


def _run(conn, sql: str, params: dict) -> None:
    """Execute sql passing only the parameters it names (keeps statements strict)."""
    names = set(re.findall(r"(?<!:):(\w+)", sql))
    conn.execute(text(sql), {k: v for k, v in params.items() if k in names})


def seed_tenant(owner_engine, job_status: str = "succeeded") -> dict:
    """Insert one complete, minimal tenant (a row in every table) as the owner."""
    ids = {k: str(uuid.uuid4()) for k in
           ("startup", "user", "icp", "prospect", "dm", "lead", "msg", "job")}
    ids["email"] = f"{ids['user']}@seed-tenant.com"
    ids["st"] = job_status
    statements = [
        "INSERT INTO startups (id, name, trial_ends_at) "
        "VALUES (:startup, 'Seed Co', now() + interval '15 days')",
        "INSERT INTO users (id, startup_id, email, password_hash) "
        "VALUES (:user, :startup, :email, 'x')",
        "INSERT INTO usage_tracker (startup_id) VALUES (:startup)",
        "INSERT INTO icps (id, startup_id, product_description, criteria_json) "
        "VALUES (:icp, :startup, 'p', CAST('{}' AS jsonb))",
        "INSERT INTO prospects (id, startup_id, icp_id, apollo_org_id, name) "
        "VALUES (:prospect, :startup, :icp, :prospect, 'Acme')",
        "INSERT INTO decision_makers (id, startup_id, prospect_id, apollo_person_id, full_name) "
        "VALUES (:dm, :startup, :prospect, :dm, 'Jane Doe')",
        "INSERT INTO leads (id, startup_id, prospect_id, dm_id) "
        "VALUES (:lead, :startup, :prospect, :dm)",
        "INSERT INTO outreach_history (id, startup_id, lead_id, direction, kind, body, status) "
        "VALUES (:msg, :startup, :lead, 'outbound', 'cold_email', 'hi', 'draft')",
        "INSERT INTO jobs (id, startup_id, type, status) VALUES (:job, :startup, 'discover', :st)",
    ]
    with owner_engine.begin() as c:
        for sql in statements:
            _run(c, sql, ids)
    return ids


@pytest.fixture
def two_tenants(owner_engine):
    return seed_tenant(owner_engine), seed_tenant(owner_engine)
