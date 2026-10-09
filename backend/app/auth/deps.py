import uuid
from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy import Connection

from app.auth.security import decode_access_token
from app.core.errors import Unauthorized
from app.db import get_engine, set_tenant

COOKIE_NAME = "access_token"


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    startup_id: uuid.UUID
    role: str


def get_token(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer ") and auth[7:].strip():
        return auth[7:].strip()
    cookie = request.cookies.get(COOKIE_NAME)
    if cookie:
        return cookie
    raise Unauthorized("Not authenticated")


def get_principal(token: str = Depends(get_token)) -> Principal:
    """The tenant comes ONLY from the verified token, never from the request body or URL."""
    payload = decode_access_token(token)
    return Principal(
        user_id=uuid.UUID(payload["sub"]),
        startup_id=uuid.UUID(payload["startup_id"]),
        role=payload.get("role", "owner"),
    )


def get_db(principal: Principal = Depends(get_principal)) -> Iterator[Connection]:
    """A tenant-scoped transaction for the request (RLS applies as app_user).

    Intended for reads. Handlers that write and must be durable before the
    response is sent should open their own `with tenant_conn(...)` block.
    """
    with get_engine().begin() as conn:
        set_tenant(conn, principal.startup_id)
        yield conn
