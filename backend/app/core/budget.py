"""BudgetGate: the single choke point for every paid external call.

    with gate.reservation(startup_id, estimate_minor) as r:
        ... call the provider ...
        r.set_actual(actual_minor, counters={"messages_generated": 1})

* reserve  : atomically adds the estimate to `reserved_minor`, or refuses.
* settle   : moves reserved -> spent using the actual cost (clamped so the cap CHECK holds).
* release  : returns the reservation untouched when the call failed.

Each step is its own short transaction, committed immediately, so a reservation is visible
to concurrent jobs while the (slow) provider call is in flight. Amounts are integer paise.
"""
import logging
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, text

from app.core.errors import BudgetExceeded
from app.db import tenant_conn

log = logging.getLogger("app.budget")

COUNTER_COLUMNS = frozenset(
    {"prospects_used", "dm_lookups_used", "messages_generated", "emails_sent",
     "apollo_dms_generated"}
)


class TrialExpired(BudgetExceeded):
    """The trial ended (or the account is suspended): no paid calls are allowed."""


RESERVE_SQL = text(
    """
    UPDATE usage_tracker u
    SET reserved_minor = u.reserved_minor + :est, updated_at = now()
    WHERE u.startup_id = :sid
      AND u.spent_minor + u.reserved_minor + :est <= u.cap_minor
      AND EXISTS (
        SELECT 1 FROM startups s
        WHERE s.id = u.startup_id
          AND (s.status = 'active' OR (s.status = 'trial' AND s.trial_ends_at > now()))
      )
    RETURNING u.startup_id
    """
)

DIAGNOSE_SQL = text(
    """
    SELECT s.status, (s.trial_ends_at <= now()) AS trial_over, u.cap_minor,
           u.spent_minor, u.reserved_minor
    FROM startups s JOIN usage_tracker u ON u.startup_id = s.id
    WHERE s.id = :sid
    """
)


def _clean_counters(counters: dict[str, int] | None) -> dict[str, int]:
    counters = counters or {}
    unknown = set(counters) - COUNTER_COLUMNS
    if unknown:
        raise ValueError(f"Unknown usage counters: {sorted(unknown)}")
    return {k: int(v) for k, v in counters.items() if int(v)}


class Reservation:
    def __init__(self, gate: "BudgetGate", startup_id: uuid.UUID | str, estimate_minor: int):
        self.gate = gate
        self.startup_id = str(startup_id)
        self.estimate_minor = estimate_minor
        self.actual_minor: int | None = None
        self.counters: dict[str, int] = {}
        self.closed = False

    def set_actual(self, actual_minor: int, counters: dict[str, int] | None = None) -> None:
        self.actual_minor = max(0, int(actual_minor))
        if counters:
            self.counters = _clean_counters(counters)

    def settle(self) -> None:
        if self.closed:
            return
        actual = self.estimate_minor if self.actual_minor is None else self.actual_minor
        if actual > self.estimate_minor:
            log.warning("cost underestimated: estimate=%s actual=%s", self.estimate_minor, actual)
        sets = [
            "reserved_minor = reserved_minor - :est",
            "spent_minor = LEAST(spent_minor + :actual, cap_minor - (reserved_minor - :est))",
            "updated_at = now()",
            *(f"{col} = {col} + :c_{col}" for col in self.counters),
        ]
        params = {"sid": self.startup_id, "est": self.estimate_minor, "actual": actual,
                  **{f"c_{k}": v for k, v in self.counters.items()}}
        with tenant_conn(self.gate.engine, self.startup_id) as conn:
            conn.execute(
                text(f"UPDATE usage_tracker SET {', '.join(sets)} WHERE startup_id = :sid"), params
            )
        self.closed = True

    def release(self) -> None:
        if self.closed:
            return
        with tenant_conn(self.gate.engine, self.startup_id) as conn:
            conn.execute(
                text(
                    "UPDATE usage_tracker SET reserved_minor = reserved_minor - :est, "
                    "updated_at = now() WHERE startup_id = :sid"
                ),
                {"sid": self.startup_id, "est": self.estimate_minor},
            )
        self.closed = True


class BudgetGate:
    def __init__(self, engine: Engine):
        self.engine = engine

    def reserve(self, startup_id: uuid.UUID | str, estimate_minor: int) -> Reservation:
        estimate_minor = int(estimate_minor)
        if estimate_minor < 0:
            raise ValueError("estimate_minor must be >= 0")
        sid = str(startup_id)
        with tenant_conn(self.engine, sid) as conn:
            granted = conn.execute(RESERVE_SQL, {"sid": sid, "est": estimate_minor}).first()
            if granted is None:
                self._raise_reason(conn, sid, estimate_minor)
        return Reservation(self, sid, estimate_minor)

    @staticmethod
    def _raise_reason(conn, sid: str, estimate_minor: int) -> None:
        row = conn.execute(DIAGNOSE_SQL, {"sid": sid}).mappings().first()
        if row is None:
            raise BudgetExceeded("No usage record for this account")
        if row["status"] == "suspended":
            raise TrialExpired("This account is suspended")
        if row["status"] == "expired" or (row["status"] == "trial" and row["trial_over"]):
            raise TrialExpired("Your 15-day trial has ended")
        remaining = row["cap_minor"] - row["spent_minor"] - row["reserved_minor"]
        raise BudgetExceeded(
            f"API spend cap reached (needs {estimate_minor} paise, {max(remaining, 0)} left)"
        )

    @contextmanager
    def reservation(
        self, startup_id: uuid.UUID | str, estimate_minor: int
    ) -> Iterator[Reservation]:
        r = self.reserve(startup_id, estimate_minor)
        try:
            yield r
        except BaseException:
            r.release()
            raise
        else:
            r.settle()
