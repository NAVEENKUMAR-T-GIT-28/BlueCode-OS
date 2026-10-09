import json
import logging
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.auth.deps import Principal, get_db, get_principal
from app.config import get_settings
from app.core.budget import BudgetExceeded
from app.core.errors import (
    Conflict,
    LLMConfigError,
    LLMError,
    LLMOutputError,
    NotFound,
    ServiceUnavailable,
    TransientError,
    Unprocessable,
)
from app.db import get_engine, tenant_conn
from app.llm.client import LLMClient
from app.llm.factory import get_llm_factory
from app.modules.icp import service
from app.modules.icp.schemas import ICPCriteria

log = logging.getLogger("app.icp")
router = APIRouter(prefix="/icps", tags=["icps"])

COLUMNS = "id, product_description, criteria_json, confirmed, created_at"
Description = Field(min_length=10, max_length=4000)


class ICPCreate(BaseModel):
    product_description: str = Description


class ICPReparse(BaseModel):
    product_description: str = Description


class ICPUpdate(BaseModel):
    criteria: ICPCriteria
    confirm: bool = False
    product_description: str | None = Field(default=None, min_length=10, max_length=4000)


class ICPOut(BaseModel):
    id: uuid.UUID
    product_description: str
    criteria: dict
    confirmed: bool
    created_at: datetime
    parse_status: Literal["ai", "manual"] | None = None
    notes: list[str] = Field(default_factory=list)


def _notes(criteria: dict) -> list[str]:
    unmapped = criteria.get("unmapped_industries") or []
    if not unmapped:
        return []
    return ["These industries are not recognised in Apollo's list and will be skipped "
            "unless you rename them: " + ", ".join(unmapped)]


def _out(row, *, parse_status=None, notes: list[str] | None = None) -> ICPOut:
    criteria = row["criteria_json"]
    return ICPOut(
        id=row["id"], product_description=row["product_description"], criteria=criteria,
        confirmed=row["confirmed"], created_at=row["created_at"], parse_status=parse_status,
        notes=[*(notes or []), *_notes(criteria)],
    )


def _failure_reason(exc: Exception) -> str:
    if isinstance(exc, LLMConfigError):
        return "AI parsing is not configured on this server yet."
    if isinstance(exc, TransientError):
        return "The AI provider is busy or unreachable right now."
    if isinstance(exc, LLMOutputError):
        return "The AI reply could not be understood."
    if isinstance(exc, BudgetExceeded):
        return str(exc)
    return "The AI provider could not process the request."


def _parse(
    factory: Callable[[], LLMClient], startup_id: uuid.UUID, description: str
) -> ICPCriteria:
    return service.parse_product_description(factory(), startup_id, description)


@router.post("", response_model=ICPOut, status_code=201)
def create_icp(
    body: ICPCreate,
    principal: Principal = Depends(get_principal),
    llm_factory: Callable[[], LLMClient] = Depends(get_llm_factory),
) -> ICPOut:
    sid = principal.startup_id
    with tenant_conn(get_engine(), sid) as conn:
        existing = conn.execute(text("SELECT count(*) FROM icps")).scalar_one()
    if existing >= get_settings().max_icps:
        raise Conflict(
            f"The pilot plan includes {get_settings().max_icps} ICP. Edit or re-parse the existing one.",
            code="icp_limit_reached",
        )

    notes: list[str] = []
    try:
        criteria = _parse(llm_factory, sid, body.product_description)
        parse_status = "ai"
    except (LLMError, TransientError, BudgetExceeded) as exc:
        log.warning("ICP parse fell back to manual entry: %s", type(exc).__name__)
        criteria, parse_status = ICPCriteria(), "manual"
        notes.append(_failure_reason(exc) + " Fill in the criteria by hand.")

    with tenant_conn(get_engine(), sid) as conn:
        row = conn.execute(
            text(
                "INSERT INTO icps (startup_id, product_description, criteria_json) "
                f"VALUES (:sid, :pd, CAST(:c AS jsonb)) RETURNING {COLUMNS}"
            ),
            {"sid": str(sid), "pd": body.product_description.strip(),
             "c": json.dumps(service.to_stored(criteria))},
        ).mappings().first()
    return _out(row, parse_status=parse_status, notes=notes)


@router.get("", response_model=list[ICPOut])
def list_icps(conn: Connection = Depends(get_db)) -> list[ICPOut]:
    rows = conn.execute(text(f"SELECT {COLUMNS} FROM icps ORDER BY created_at")).mappings()
    return [_out(r) for r in rows]


@router.get("/{icp_id}", response_model=ICPOut)
def get_icp(icp_id: uuid.UUID, conn: Connection = Depends(get_db)) -> ICPOut:
    row = conn.execute(
        text(f"SELECT {COLUMNS} FROM icps WHERE id = :id"), {"id": str(icp_id)}
    ).mappings().first()
    if row is None:
        raise NotFound("ICP not found")
    return _out(row)


@router.put("/{icp_id}", response_model=ICPOut)
def update_icp(
    icp_id: uuid.UUID, body: ICPUpdate, principal: Principal = Depends(get_principal)
) -> ICPOut:
    if body.confirm:
        missing = service.missing_for_confirmation(body.criteria)
        if missing:
            raise Unprocessable(
                "Add at least one value for: " + ", ".join(missing) + " before confirming.",
                code="icp_incomplete", details={"missing": missing},
            )
    with tenant_conn(get_engine(), principal.startup_id) as conn:
        row = conn.execute(
            text(
                "UPDATE icps SET criteria_json = CAST(:c AS jsonb), confirmed = :confirmed, "
                "product_description = COALESCE(:pd, product_description) "
                f"WHERE id = :id RETURNING {COLUMNS}"
            ),
            {"id": str(icp_id), "c": json.dumps(service.to_stored(body.criteria)),
             "confirmed": body.confirm, "pd": body.product_description},
        ).mappings().first()
    if row is None:
        raise NotFound("ICP not found")
    return _out(row)


@router.post("/{icp_id}/reparse", response_model=ICPOut)
def reparse_icp(
    icp_id: uuid.UUID,
    body: ICPReparse,
    principal: Principal = Depends(get_principal),
    llm_factory: Callable[[], LLMClient] = Depends(get_llm_factory),
) -> ICPOut:
    """Re-run the AI parse on a new description. Resets confirmation. Existing data is kept
    if the AI is unavailable."""
    sid = principal.startup_id
    with tenant_conn(get_engine(), sid) as conn:
        if conn.execute(text("SELECT 1 FROM icps WHERE id = :id"), {"id": str(icp_id)}).first() is None:
            raise NotFound("ICP not found")
    try:
        criteria = _parse(llm_factory, sid, body.product_description)
    except (LLMError, TransientError, BudgetExceeded) as exc:
        raise ServiceUnavailable(
            _failure_reason(exc) + " Your existing criteria were not changed.",
            code="llm_unavailable",
        ) from exc
    with tenant_conn(get_engine(), sid) as conn:
        row = conn.execute(
            text(
                "UPDATE icps SET criteria_json = CAST(:c AS jsonb), confirmed = false, "
                f"product_description = :pd WHERE id = :id RETURNING {COLUMNS}"
            ),
            {"id": str(icp_id), "pd": body.product_description.strip(),
             "c": json.dumps(service.to_stored(criteria))},
        ).mappings().first()
    return _out(row, parse_status="ai")
