#!/bin/bash
# Runs once, on first initialisation of the Postgres data volume.
# Creates the two runtime roles. They are NOT superusers and do NOT bypass
# Row-Level Security, which is what makes tenant isolation enforceable.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
CREATE ROLE app_user    LOGIN PASSWORD '${APP_DB_PASSWORD}'    NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE worker_user LOGIN PASSWORD '${WORKER_DB_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
EOSQL
