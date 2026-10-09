import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Connection, text

from app.auth.deps import get_db
from app.core.errors import Conflict, NotFound

router = APIRouter(prefix="/jobs", tags=["jobs"])

JobStatus = Literal["queued", "running", "succeeded", "partial", "failed", "paused_budget"]

COLUMNS = (
    "id, type, status, total, done, failed, error, attempts, max_attempts, "
    "run_after, created_at, finished_at"
)


class JobOut(BaseModel):
    id: uuid.UUID
    type: str
    status: JobStatus
    total: int
    done: int
    failed: int
    error: str | None
    attempts: int
    max_attempts: int
    run_after: datetime
    created_at: datetime
    finished_at: datetime | None


@router.get("", response_model=list[JobOut])
def list_jobs(
    status: JobStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    conn: Connection = Depends(get_db),
) -> list[dict]:
    # No startup_id filter is needed or trusted here: RLS limits rows to the caller's tenant.
    sql = f"SELECT {COLUMNS} FROM jobs"
    params: dict = {"limit": limit}
    if status:
        sql += " WHERE status = :status"
        params["status"] = status
    sql += " ORDER BY created_at DESC LIMIT :limit"
    return [dict(r) for r in conn.execute(text(sql), params).mappings()]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: uuid.UUID, conn: Connection = Depends(get_db)) -> dict:
    row = conn.execute(
        text(f"SELECT {COLUMNS} FROM jobs WHERE id = :id"), {"id": str(job_id)}
    ).mappings().first()
    if row is None:  # also the answer for another tenant's job: 404, never 403
        raise NotFound("Job not found")
    return dict(row)


@router.post("/{job_id}/retry", response_model=JobOut)
def retry_job(job_id: uuid.UUID, conn: Connection = Depends(get_db)) -> dict:
    row = conn.execute(
        text(
            "UPDATE jobs SET status = 'queued', attempts = 0, error = NULL, run_after = now(), "
            "locked_at = NULL, finished_at = NULL "
            f"WHERE id = :id AND status IN ('failed','partial','paused_budget') RETURNING {COLUMNS}"
        ),
        {"id": str(job_id)},
    ).mappings().first()
    if row is not None:
        return dict(row)
    exists = conn.execute(
        text("SELECT 1 FROM jobs WHERE id = :id"), {"id": str(job_id)}
    ).first()
    if exists is None:
        raise NotFound("Job not found")
    raise Conflict("Only failed, partial or paused jobs can be retried", code="not_retryable")
