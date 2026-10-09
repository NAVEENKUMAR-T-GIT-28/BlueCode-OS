"""Postgres-backed job queue (no Redis).

Claiming uses FOR UPDATE SKIP LOCKED so concurrent workers never take the same job.
All functions take the WORKER engine (role worker_user), whose RLS policy on the
jobs table spans tenants. Tenant data is only ever touched through tenant_conn().
"""
import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Connection, Engine, text

BACKOFF_SECONDS = (30, 120, 600)


@dataclass(frozen=True)
class Job:
    id: uuid.UUID
    startup_id: uuid.UUID
    type: str
    params: dict[str, Any]
    attempts: int
    max_attempts: int


CLAIM_SQL = text(
    """
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1, error = NULL
    WHERE id = (
      SELECT j.id FROM jobs j
      WHERE j.status = 'queued' AND j.run_after <= now()
        AND (SELECT count(*) FROM jobs r
             WHERE r.startup_id = j.startup_id AND r.status = 'running') < :max_running
      ORDER BY j.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, startup_id, type, params_json, attempts, max_attempts
    """
)


def enqueue(
    conn: Connection,
    startup_id: uuid.UUID | str,
    job_type: str,
    params: dict[str, Any] | None = None,
    total: int = 0,
) -> uuid.UUID:
    """Insert a queued job. `conn` must already be a tenant-scoped connection."""
    job_id = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO jobs (id, startup_id, type, params_json, total) "
            "VALUES (:id, :sid, :type, CAST(:params AS jsonb), :total)"
        ),
        {
            "id": str(job_id),
            "sid": str(startup_id),
            "type": job_type,
            "params": json.dumps(params or {}),
            "total": total,
        },
    )
    return job_id


def claim_next(engine: Engine, max_running: int = 2) -> Job | None:
    with engine.begin() as conn:
        row = conn.execute(CLAIM_SQL, {"max_running": max_running}).mappings().first()
    if row is None:
        return None
    return Job(
        id=row["id"],
        startup_id=row["startup_id"],
        type=row["type"],
        params=row["params_json"] or {},
        attempts=row["attempts"],
        max_attempts=row["max_attempts"],
    )


def heartbeat(engine: Engine, job_id: uuid.UUID) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE jobs SET locked_at = now() WHERE id = :id AND status = 'running'"),
            {"id": str(job_id)},
        )


def set_progress(
    engine: Engine,
    job_id: uuid.UUID,
    *,
    total: int | None = None,
    done: int | None = None,
    failed: int | None = None,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE jobs SET total = COALESCE(:t, total), done = COALESCE(:d, done), "
                "failed = COALESCE(:f, failed) WHERE id = :id"
            ),
            {"t": total, "d": done, "f": failed, "id": str(job_id)},
        )


def finish(engine: Engine, job_id: uuid.UUID, status: str, error: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE jobs SET status = :s, error = :e, finished_at = now(), locked_at = NULL "
                "WHERE id = :id"
            ),
            {"s": status, "e": (error or None) and error[:1000], "id": str(job_id)},
        )


def retry_or_fail(engine: Engine, job: Job, error: str) -> str:
    """Re-queue with backoff, or mark failed once max_attempts is reached. Returns new status."""
    if job.attempts >= job.max_attempts:
        finish(engine, job.id, "failed", error)
        return "failed"
    delay = BACKOFF_SECONDS[min(job.attempts - 1, len(BACKOFF_SECONDS) - 1)]
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE jobs SET status = 'queued', locked_at = NULL, error = :e, "
                "run_after = now() + (:delay * interval '1 second') WHERE id = :id"
            ),
            {"e": error[:1000], "delay": delay, "id": str(job.id)},
        )
    return "queued"


def recover_stale(engine: Engine, stale_seconds: int = 300) -> int:
    """Recover jobs whose worker died: re-queue them, or fail them if attempts are exhausted."""
    with engine.begin() as conn:
        failed = conn.execute(
            text(
                "UPDATE jobs SET status = 'failed', locked_at = NULL, finished_at = now(), "
                "error = 'Worker stopped before the job finished' "
                "WHERE status = 'running' AND attempts >= max_attempts "
                "AND locked_at < now() - (:s * interval '1 second')"
            ),
            {"s": stale_seconds},
        ).rowcount
        requeued = conn.execute(
            text(
                "UPDATE jobs SET status = 'queued', locked_at = NULL "
                "WHERE status = 'running' AND attempts < max_attempts "
                "AND locked_at < now() - (:s * interval '1 second')"
            ),
            {"s": stale_seconds},
        ).rowcount
    return failed + requeued
