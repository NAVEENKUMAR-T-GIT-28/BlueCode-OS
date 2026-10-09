from datetime import UTC, datetime
from math import ceil

from fastapi import APIRouter, Depends
from sqlalchemy import Connection, text

from app.auth.deps import Principal, get_db, get_principal
from app.core.errors import NotFound

router = APIRouter(tags=["usage"])


@router.get("/usage")
def get_usage(
    principal: Principal = Depends(get_principal), conn: Connection = Depends(get_db)
) -> dict:
    row = conn.execute(
        text(
            "SELECT u.cap_minor, u.reserved_minor, u.spent_minor, u.prospects_used, "
            "u.dm_lookups_used, u.messages_generated, u.emails_sent, u.apollo_dms_generated, "
            "s.status, s.trial_ends_at "
            "FROM usage_tracker u JOIN startups s ON s.id = u.startup_id "
            "WHERE u.startup_id = :sid"
        ),
        {"sid": str(principal.startup_id)},
    ).mappings().first()
    if row is None:
        raise NotFound("Usage record not found")
    data = dict(row)
    remaining_seconds = (data["trial_ends_at"] - datetime.now(UTC)).total_seconds()
    data["remaining_minor"] = data["cap_minor"] - data["spent_minor"] - data["reserved_minor"]
    data["trial_days_left"] = max(0, ceil(remaining_seconds / 86400))
    return data
