"""Alembic environment. Migrations run as the database OWNER role (never app_user)."""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = None  # schema is managed with explicit SQL migrations


def _url() -> str:
    url = os.environ.get("MIGRATION_DATABASE_URL")
    if not url:
        try:
            from app.config import get_settings
            url = get_settings().migration_database_url
        except Exception:
            pass
    if not url:
        raise RuntimeError("MIGRATION_DATABASE_URL is not set")
    return url


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
