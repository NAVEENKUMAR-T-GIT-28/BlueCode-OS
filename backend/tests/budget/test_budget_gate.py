import threading

import pytest
from sqlalchemy import text

from app.core.budget import BudgetGate, TrialExpired
from app.core.errors import BudgetExceeded
from tests.conftest import seed_tenant


@pytest.fixture
def gate(app_engine):
    return BudgetGate(app_engine)


@pytest.fixture
def tenant(owner_engine):
    t = seed_tenant(owner_engine)
    set_usage(owner_engine, t["startup"], cap=1000)
    return t


def set_usage(owner_engine, sid, *, cap, spent=0, reserved=0):
    with owner_engine.begin() as c:
        c.execute(text("UPDATE usage_tracker SET cap_minor=:c, spent_minor=:s, reserved_minor=:r "
                       "WHERE startup_id=:i"), {"c": cap, "s": spent, "r": reserved, "i": sid})


def usage(owner_engine, sid):
    with owner_engine.connect() as c:
        return c.execute(text("SELECT * FROM usage_tracker WHERE startup_id=:i"),
                         {"i": sid}).mappings().one()


def test_settle_moves_reserved_to_spent_and_counts_usage(gate, tenant, owner_engine):
    with gate.reservation(tenant["startup"], 300) as r:
        assert usage(owner_engine, tenant["startup"])["reserved_minor"] == 300
        r.set_actual(120, counters={"messages_generated": 2, "emails_sent": 1})
    u = usage(owner_engine, tenant["startup"])
    assert (u["reserved_minor"], u["spent_minor"]) == (0, 120)
    assert (u["messages_generated"], u["emails_sent"], u["prospects_used"]) == (2, 1, 0)


def test_settles_at_the_estimate_when_no_actual_is_given(gate, tenant, owner_engine):
    with gate.reservation(tenant["startup"], 250):
        pass
    assert usage(owner_engine, tenant["startup"])["spent_minor"] == 250


def test_failure_inside_the_block_releases_the_reservation(gate, tenant, owner_engine):
    with pytest.raises(RuntimeError):
        with gate.reservation(tenant["startup"], 400):
            raise RuntimeError("provider blew up")
    u = usage(owner_engine, tenant["startup"])
    assert (u["reserved_minor"], u["spent_minor"]) == (0, 0)


def test_over_cap_is_refused_and_nothing_is_reserved(gate, tenant, owner_engine):
    with pytest.raises(BudgetExceeded) as exc:
        gate.reserve(tenant["startup"], 1001)
    assert not isinstance(exc.value, TrialExpired) and "cap" in str(exc.value).lower()
    assert usage(owner_engine, tenant["startup"])["reserved_minor"] == 0


def test_cap_is_inclusive_then_blocks(gate, tenant):
    held = gate.reserve(tenant["startup"], 1000)
    with pytest.raises(BudgetExceeded):
        gate.reserve(tenant["startup"], 1)
    held.release()
    gate.reserve(tenant["startup"], 1).release()


def test_free_calls_still_pass_at_the_cap(gate, tenant, owner_engine):
    set_usage(owner_engine, tenant["startup"], cap=1000, spent=1000)
    with gate.reservation(tenant["startup"], 0):
        pass


def test_actual_above_estimate_is_clamped_to_the_cap(gate, tenant, owner_engine):
    with gate.reservation(tenant["startup"], 100) as r:
        r.set_actual(5000)
    u = usage(owner_engine, tenant["startup"])
    assert u["spent_minor"] == 1000 and u["reserved_minor"] == 0  # CHECK constraint held


def test_unknown_counter_is_rejected_without_side_effects(gate, tenant, owner_engine):
    with pytest.raises(ValueError):
        with gate.reservation(tenant["startup"], 10) as r:
            r.set_actual(10, counters={"cap_minor": 5})
    u = usage(owner_engine, tenant["startup"])
    assert (u["reserved_minor"], u["spent_minor"], u["cap_minor"]) == (0, 0, 1000)


def test_parallel_reservations_can_never_exceed_the_cap(gate, tenant, owner_engine):
    granted, refused, lock = [], [], threading.Lock()
    barrier = threading.Barrier(40)

    def worker():
        barrier.wait()
        try:
            r = gate.reserve(tenant["startup"], 100)
            with lock:
                granted.append(r)
        except BudgetExceeded:
            with lock:
                refused.append(1)

    threads = [threading.Thread(target=worker) for _ in range(40)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(granted) == 10 and len(refused) == 30
    u = usage(owner_engine, tenant["startup"])
    assert u["reserved_minor"] + u["spent_minor"] == 1000


@pytest.mark.parametrize("sql,message", [
    ("UPDATE startups SET trial_ends_at = now() - interval '1 day' WHERE id = :i", "trial"),
    ("UPDATE startups SET status = 'expired' WHERE id = :i", "trial"),
    ("UPDATE startups SET status = 'suspended' WHERE id = :i", "suspended"),
])
def test_expired_or_suspended_accounts_cannot_spend(gate, tenant, owner_engine, sql, message):
    with owner_engine.begin() as c:
        c.execute(text(sql), {"i": tenant["startup"]})
    with pytest.raises(TrialExpired) as exc:
        gate.reserve(tenant["startup"], 0)  # even free calls are blocked
    assert message in str(exc.value).lower()


def test_active_paid_account_is_not_limited_by_trial_date(gate, tenant, owner_engine):
    with owner_engine.begin() as c:
        c.execute(text("UPDATE startups SET status='active', trial_ends_at = now() - interval '30 days' "
                       "WHERE id = :i"), {"i": tenant["startup"]})
    gate.reserve(tenant["startup"], 10).release()
