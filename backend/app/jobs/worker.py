"""Worker process: python -m app.jobs.worker

Polls the jobs table, runs the registered handler for each claimed job, keeps a
heartbeat so crashed jobs can be recovered, and reports progress for the UI.
"""
import logging
import signal
import threading
import time
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Connection, Engine

from app.config import get_settings
from app.core.errors import BudgetExceeded, TransientError
from app.db import get_worker_engine, tenant_conn
from app.jobs import queue

log = logging.getLogger("app.worker")

Handler = Callable[["JobContext"], str | None]
HANDLERS: dict[str, Handler] = {}


def register(job_type: str) -> Callable[[Handler], Handler]:
    def decorator(fn: Handler) -> Handler:
        HANDLERS[job_type] = fn
        return fn

    return decorator


@dataclass
class JobContext:
    job: queue.Job
    engine: Engine

    @property
    def startup_id(self) -> uuid.UUID:
        return self.job.startup_id

    @property
    def params(self) -> dict[str, Any]:
        return self.job.params

    @contextmanager
    def tenant(self) -> Iterator[Connection]:
        """A tenant-scoped transaction for this job's startup (RLS enforced)."""
        with tenant_conn(self.engine, self.job.startup_id) as conn:
            yield conn

    def progress(
        self, *, total: int | None = None, done: int | None = None, failed: int | None = None
    ) -> None:
        queue.set_progress(self.engine, self.job.id, total=total, done=done, failed=failed)


def _heartbeat_loop(engine: Engine, job_id: uuid.UUID, stop: threading.Event, every: float) -> None:
    while not stop.wait(every):
        try:
            queue.heartbeat(engine, job_id)
        except Exception:
            log.exception("heartbeat failed for job %s", job_id)


def run_one(engine: Engine, *, max_running: int | None = None) -> bool:
    """Claim and run a single job. Returns False if nothing was runnable."""
    s = get_settings()
    job = queue.claim_next(engine, max_running or s.max_running_jobs_per_startup)
    if job is None:
        return False

    handler = HANDLERS.get(job.type)
    if handler is None:
        queue.finish(engine, job.id, "failed", f"No handler registered for job type '{job.type}'")
        return True

    stop = threading.Event()
    beat = threading.Thread(
        target=_heartbeat_loop,
        args=(engine, job.id, stop, s.job_heartbeat_seconds),
        daemon=True,
    )
    beat.start()
    try:
        outcome = handler(JobContext(job=job, engine=engine)) or "succeeded"
        if outcome not in ("succeeded", "partial"):
            raise ValueError(f"Handler returned invalid outcome '{outcome}'")
        queue.finish(engine, job.id, outcome)
    except BudgetExceeded as exc:
        queue.finish(engine, job.id, "paused_budget", str(exc) or "Budget exhausted")
    except TransientError as exc:
        queue.retry_or_fail(engine, job, str(exc) or "Temporary failure")
    except Exception as exc:
        log.exception("job %s (%s) failed", job.id, job.type)
        queue.finish(engine, job.id, "failed", f"{type(exc).__name__}: {exc}")
    finally:
        stop.set()
        beat.join(timeout=5)
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    import app.jobs.handlers  # noqa: F401  (registers handlers)

    s = get_settings()
    s.validate_for_runtime()
    engine = get_worker_engine()
    running = True

    def _stop(*_: object) -> None:
        nonlocal running
        running = False
        log.info("shutdown requested")

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    recovered = queue.recover_stale(engine, s.job_stale_seconds)
    log.info("worker started (recovered %d stale jobs)", recovered)
    last_recover = time.monotonic()
    while running:
        try:
            did_work = run_one(engine)
        except Exception:
            log.exception("worker loop error")
            did_work = False
        if not did_work:
            time.sleep(s.worker_poll_seconds)
        if time.monotonic() - last_recover > 60:
            queue.recover_stale(engine, s.job_stale_seconds)
            last_recover = time.monotonic()
    log.info("worker stopped")


if __name__ == "__main__":
    main()
