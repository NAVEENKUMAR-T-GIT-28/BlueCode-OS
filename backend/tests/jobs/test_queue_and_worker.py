import threading
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.errors import BudgetExceeded, TransientError
from app.db import tenant_conn
from app.jobs import queue, worker
from tests.conftest import seed_tenant


# ---- test-only handlers (production handlers arrive in later sprints) ---------------
@worker.register("t_ok")
def _ok(ctx):
    ctx.progress(total=3)
    for i in range(1, 4):
        ctx.progress(done=i)


@worker.register("t_partial")
def _partial(ctx):
    ctx.progress(total=10, done=8, failed=2)
    return "partial"


@worker.register("t_transient")
def _transient(ctx):
    raise TransientError("Apollo timed out")


@worker.register("t_budget")
def _budget(ctx):
    raise BudgetExceeded("Spend cap reached")


@worker.register("t_boom")
def _boom(ctx):
    raise RuntimeError("unexpected")


@worker.register("t_tenant")
def _tenant(ctx):
    with ctx.tenant() as conn:
        n = conn.execute(text("SELECT count(*) FROM leads")).scalar_one()
        other = conn.execute(text("SELECT count(*) FROM leads WHERE startup_id <> :s"),
                             {"s": str(ctx.startup_id)}).scalar_one()
    assert other == 0, "handler could see another tenant's leads"
    ctx.progress(done=n, total=n)


def add_job(owner_engine, startup_id, job_type, **cols):
    job_id = str(uuid.uuid4())
    names = ["id", "startup_id", "type", *cols]
    values = {"id": job_id, "startup_id": startup_id, "type": job_type, **cols}
    sql = f"INSERT INTO jobs ({', '.join(names)}) VALUES ({', '.join(':' + n for n in names)})"
    with owner_engine.begin() as c:
        c.execute(text(sql), values)
    return job_id


def row(owner_engine, job_id):
    with owner_engine.connect() as c:
        return c.execute(text("SELECT * FROM jobs WHERE id = :i"), {"i": job_id}).mappings().one()


def test_enqueue_via_tenant_connection(app_engine, worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    with tenant_conn(app_engine, t["startup"]) as conn:
        job_id = queue.enqueue(conn, t["startup"], "t_ok", {"limit": 5}, total=5)
    r = row(owner_engine, str(job_id))
    assert (r["status"], r["total"], r["params_json"]) == ("queued", 5, {"limit": 5})


def test_enqueue_for_a_different_tenant_is_blocked(app_engine, owner_engine, empty_jobs):
    a, b = seed_tenant(owner_engine), seed_tenant(owner_engine)
    with pytest.raises(DBAPIError) as exc:
        with tenant_conn(app_engine, a["startup"]) as conn:
            queue.enqueue(conn, b["startup"], "t_ok")
    assert "row-level security" in str(exc.value)


def test_successful_job_reports_progress(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "t_ok", status="queued")
    assert worker.run_one(worker_engine) is True
    r = row(owner_engine, jid)
    assert (r["status"], r["done"], r["total"], r["attempts"]) == ("succeeded", 3, 3, 1)
    assert r["finished_at"] is not None and r["locked_at"] is None


def test_idle_queue_returns_false(worker_engine, empty_jobs):
    assert worker.run_one(worker_engine) is False


def test_partial_outcome(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "t_partial", status="queued")
    worker.run_one(worker_engine)
    r = row(owner_engine, jid)
    assert (r["status"], r["done"], r["failed"]) == ("partial", 8, 2)


def test_budget_exceeded_pauses_job(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "t_budget", status="queued")
    worker.run_one(worker_engine)
    r = row(owner_engine, jid)
    assert r["status"] == "paused_budget" and "cap" in r["error"].lower()


def test_unknown_job_type_fails_cleanly(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "no_such_type", status="queued")
    worker.run_one(worker_engine)
    r = row(owner_engine, jid)
    assert r["status"] == "failed" and "No handler" in r["error"]


def test_unexpected_exception_fails_without_retry(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "t_boom", status="queued")
    worker.run_one(worker_engine)
    r = row(owner_engine, jid)
    assert r["status"] == "failed" and "RuntimeError" in r["error"]


def test_transient_failures_back_off_then_fail(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    jid = add_job(owner_engine, t["startup"], "t_transient", status="queued")

    for attempt in (1, 2):
        assert worker.run_one(worker_engine) is True
        r = row(owner_engine, jid)
        assert (r["status"], r["attempts"]) == ("queued", attempt)
        with owner_engine.connect() as c:
            in_future = c.execute(text("SELECT run_after > now() FROM jobs WHERE id = :i"),
                                  {"i": jid}).scalar_one()
        assert in_future  # backoff applied
        assert worker.run_one(worker_engine) is False  # not runnable yet
        with owner_engine.begin() as c:
            c.execute(text("UPDATE jobs SET run_after = now() WHERE id = :i"), {"i": jid})

    assert worker.run_one(worker_engine) is True
    r = row(owner_engine, jid)
    assert (r["status"], r["attempts"]) == ("failed", 3)
    assert "timed out" in r["error"]


def test_handler_runs_inside_its_own_tenant_only(worker_engine, owner_engine, empty_jobs):
    a, b = seed_tenant(owner_engine), seed_tenant(owner_engine)
    jid = add_job(owner_engine, a["startup"], "t_tenant", status="queued")
    worker.run_one(worker_engine)
    r = row(owner_engine, jid)
    assert r["status"] == "succeeded", r["error"]
    assert r["done"] == 1  # only tenant A's single lead was visible
    assert b["startup"] != a["startup"]


def test_no_job_is_ever_claimed_twice_under_concurrency(worker_engine, owner_engine, empty_jobs):
    tenants = [seed_tenant(owner_engine)["startup"] for _ in range(5)]
    for i in range(40):
        add_job(owner_engine, tenants[i % 5], "t_ok", status="queued")

    claimed, lock = [], threading.Lock()

    def drain():
        while True:
            job = queue.claim_next(worker_engine, max_running=10_000)
            if job is None:
                return
            with lock:
                claimed.append(job.id)

    threads = [threading.Thread(target=drain) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(claimed) == 40 and len(set(claimed)) == 40


def test_per_startup_running_limit(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    for _ in range(5):
        add_job(owner_engine, t["startup"], "t_ok", status="queued")
    claimed = [queue.claim_next(worker_engine, max_running=2) for _ in range(5)]
    assert sum(j is not None for j in claimed) == 2  # fairness cap


def test_stale_running_jobs_are_recovered(worker_engine, owner_engine, empty_jobs):
    t = seed_tenant(owner_engine)
    crashed = add_job(owner_engine, t["startup"], "t_ok", status="running", attempts=1)
    exhausted = add_job(owner_engine, t["startup"], "t_ok", status="running", attempts=3)
    fresh = add_job(owner_engine, t["startup"], "t_ok", status="running", attempts=1)
    with owner_engine.begin() as c:
        c.execute(text("UPDATE jobs SET locked_at = now() - interval '10 minutes' WHERE id IN (:a, :b)"),
                  {"a": crashed, "b": exhausted})
        c.execute(text("UPDATE jobs SET locked_at = now() WHERE id = :f"), {"f": fresh})
    assert queue.recover_stale(worker_engine, stale_seconds=300) == 2
    assert row(owner_engine, crashed)["status"] == "queued"
    assert row(owner_engine, exhausted)["status"] == "failed"
    assert row(owner_engine, fresh)["status"] == "running"
