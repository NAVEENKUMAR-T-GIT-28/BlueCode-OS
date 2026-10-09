import re
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from app.auth.deps import Principal, get_principal
from app.core.crypto import (
    DecryptionFailed,
    EncryptionNotConfigured,
    decrypt_for,
    encrypt_for,
)
from app.core.errors import NotFound, ServiceUnavailable
from app.db import get_engine, tenant_conn

router = APIRouter(prefix="/settings", tags=["settings"])

HOST_RE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")


class MailboxIn(BaseModel):
    host: str = Field(max_length=253)
    port: int = Field(ge=1, le=65535)
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=512)
    security: Literal["ssl", "starttls", "none"] = "ssl"

    @field_validator("host")
    @classmethod
    def _host(cls, v: str) -> str:
        v = v.strip()
        if not HOST_RE.match(v):
            raise ValueError("Enter a host name such as smtp.example.com (no https:// or spaces)")
        return v


class SettingsUpdate(BaseModel):
    """Only the fields you send are changed. smtp/imap/booking_link/sender_* may be sent as
    null to clear them. Mailbox passwords are write-only and never returned."""

    company_name: str | None = Field(default=None, min_length=1, max_length=120)
    sender_name: str | None = Field(default=None, max_length=120)
    sender_address: str | None = Field(default=None, max_length=300)
    booking_link: str | None = Field(default=None, max_length=500)
    smtp: MailboxIn | None = None
    imap: MailboxIn | None = None

    @field_validator("booking_link")
    @classmethod
    def _https_only(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not re.match(r"^https://[^\s/]+\.[^\s/]+(/\S*)?$", v):
            raise ValueError("Booking link must be a full https:// URL")
        return v


class SettingsOut(BaseModel):
    company_name: str
    plan: str
    status: str
    trial_ends_at: datetime
    sender_name: str | None
    sender_address: str | None
    booking_link: str | None
    daily_send_cap: int
    smtp: dict
    imap: dict


def _mailbox_view(startup_id: uuid.UUID, field: str, blob: bytes | None) -> dict:
    if blob is None:
        return {"configured": False}
    try:
        cfg = decrypt_for(str(startup_id), field, blob)
    except (DecryptionFailed, EncryptionNotConfigured):
        return {"configured": True, "readable": False}
    return {"configured": True, "readable": True, **{k: cfg[k] for k in
            ("host", "port", "username", "security")}}


def _load(conn, startup_id: uuid.UUID) -> SettingsOut:
    row = conn.execute(
        text(
            "SELECT name, plan, status, trial_ends_at, sender_name, sender_address, "
            "booking_link, daily_send_cap, smtp_config_enc, imap_config_enc "
            "FROM startups WHERE id = :sid"
        ),
        {"sid": str(startup_id)},
    ).mappings().first()
    if row is None:
        raise NotFound("Account not found")
    return SettingsOut(
        company_name=row["name"], plan=row["plan"], status=row["status"],
        trial_ends_at=row["trial_ends_at"], sender_name=row["sender_name"],
        sender_address=row["sender_address"], booking_link=row["booking_link"],
        daily_send_cap=row["daily_send_cap"],
        smtp=_mailbox_view(startup_id, "smtp", row["smtp_config_enc"]),
        imap=_mailbox_view(startup_id, "imap", row["imap_config_enc"]),
    )


@router.get("", response_model=SettingsOut)
def get_settings_view(principal: Principal = Depends(get_principal)) -> SettingsOut:
    with tenant_conn(get_engine(), principal.startup_id) as conn:
        return _load(conn, principal.startup_id)


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate, principal: Principal = Depends(get_principal)
) -> SettingsOut:
    sid = principal.startup_id
    sent = body.model_fields_set
    sets: list[str] = []
    params: dict = {"sid": str(sid)}

    if "company_name" in sent and body.company_name:
        sets.append("name = :company_name")
        params["company_name"] = body.company_name.strip()
    for field in ("sender_name", "sender_address", "booking_link"):
        if field in sent:
            value = getattr(body, field)
            sets.append(f"{field} = :{field}")
            params[field] = value.strip() if isinstance(value, str) and value.strip() else None
    for field, column in (("smtp", "smtp_config_enc"), ("imap", "imap_config_enc")):
        if field in sent:
            mailbox = getattr(body, field)
            sets.append(f"{column} = :{column}")
            try:
                params[column] = (
                    None if mailbox is None
                    else encrypt_for(str(sid), field, mailbox.model_dump())
                )
            except EncryptionNotConfigured as exc:
                raise ServiceUnavailable(
                    "Secure storage for mailbox passwords is not configured on this server.",
                    code="encryption_not_configured",
                ) from exc

    with tenant_conn(get_engine(), sid) as conn:
        if sets:
            conn.execute(text(f"UPDATE startups SET {', '.join(sets)} WHERE id = :sid"), params)
        return _load(conn, sid)
