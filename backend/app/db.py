"""Database engines and the tenant context.

Every tenant-scoped query runs inside a transaction that begins with
set_config('app.current_startup_id', <uuid>, true). The 'true' makes it
transaction-local (equivalent to SET LOCAL), so a pooled connection can never
carry one tenant's context into another request. Row-Level Security policies
read this setting; with no setting every tenant table returns zero rows.
"""
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine, text

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().database_url, pool_pre_ping=True, pool_size=10, max_overflow=10
    )


@lru_cache
def get_worker_engine() -> Engine:
    return create_engine(
        get_settings().worker_database_url, pool_pre_ping=True, pool_size=5, max_overflow=10
    )


def set_tenant(conn: Connection, startup_id: uuid.UUID | str) -> None:
    sid = str(uuid.UUID(str(startup_id)))  # rejects anything that is not a UUID
    conn.execute(text("SELECT set_config('app.current_startup_id', :sid, true)"), {"sid": sid})


@contextmanager
def tenant_conn(engine: Engine, startup_id: uuid.UUID | str) -> Iterator[Connection]:
    """A transaction scoped to one tenant. Commits on success, rolls back on error."""
    with engine.begin() as conn:
        set_tenant(conn, startup_id)
        yield conn
