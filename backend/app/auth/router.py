import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Connection, text
from sqlalchemy.exc import IntegrityError

from app.auth.deps import COOKIE_NAME, Principal, get_db, get_principal
from app.auth.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.auth.throttle import email_throttle, ip_throttle
from app.config import get_settings
from app.core.errors import Conflict, Forbidden, TooManyRequests, Unauthorized
from app.db import get_engine, set_tenant

router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["auth"])


class SignupIn(BaseModel):
    startup_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _set_session_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=s.jwt_expire_minutes * 60,
        httponly=True,
        secure=s.secure_cookies,
        samesite="lax",
        path="/",
    )


@router.post("/signup", status_code=201)
def signup(body: SignupIn, response: Response) -> dict:
    s = get_settings()
    startup_id, user_id = uuid.uuid4(), uuid.uuid4()
    email = body.email.lower()
    trial_ends_at = datetime.now(UTC) + timedelta(days=s.trial_days)
    try:
        with get_engine().begin() as conn:
            # The new tenant id is set first so the RLS WITH CHECK clauses pass for
            # exactly this tenant's rows and no other.
            set_tenant(conn, startup_id)
            conn.execute(
                text(
                    "INSERT INTO startups (id, name, status, trial_ends_at) "
                    "VALUES (:id, :name, 'trial', :ends)"
                ),
                {"id": str(startup_id), "name": body.startup_name.strip(), "ends": trial_ends_at},
            )
            conn.execute(
                text(
                    "INSERT INTO users (id, startup_id, email, password_hash, role) "
                    "VALUES (:id, :sid, :email, :pw, 'owner')"
                ),
                {
                    "id": str(user_id),
                    "sid": str(startup_id),
                    "email": email,
                    "pw": hash_password(body.password),
                },
            )
            conn.execute(
                text("INSERT INTO usage_tracker (startup_id, cap_minor) VALUES (:sid, :cap)"),
                {"sid": str(startup_id), "cap": s.trial_cap_minor},
            )
    except IntegrityError as exc:
        if getattr(exc.orig, "pgcode", None) == "23505":
            raise Conflict(
                "An account with this email already exists", code="email_taken"
            ) from exc
        raise

    _set_session_cookie(
        response, create_access_token(user_id=user_id, startup_id=startup_id, role="owner")
    )
    return {
        "user_id": str(user_id),
        "startup_id": str(startup_id),
        "email": email,
        "trial_ends_at": trial_ends_at.isoformat(),
    }


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response) -> dict:
    email = body.email.lower()
    ip = _client_ip(request)
    if email_throttle.blocked(email) or ip_throttle.blocked(ip):
        raise TooManyRequests("Too many failed attempts. Try again in 15 minutes.")

    with get_engine().begin() as conn:
        # Narrow RLS policy 'auth_lookup': only the row matching this email is visible.
        conn.execute(text("SELECT set_config('app.auth_email', :e, true)"), {"e": email})
        row = conn.execute(
            text("SELECT id, startup_id, password_hash, role FROM users WHERE email = :e"),
            {"e": email},
        ).first()
        valid = verify_password(row.password_hash if row else DUMMY_HASH, body.password)
        status = None
        if row and valid:
            set_tenant(conn, row.startup_id)
            status = conn.execute(
                text("SELECT status FROM startups WHERE id = :id"), {"id": str(row.startup_id)}
            ).scalar_one_or_none()

    if not (row and valid):
        email_throttle.record(email)
        ip_throttle.record(ip)
        raise Unauthorized("Invalid email or password", code="invalid_credentials")
    if status == "suspended":
        raise Forbidden("This account is suspended", code="account_suspended")

    email_throttle.reset(email)
    _set_session_cookie(
        response,
        create_access_token(user_id=row.id, startup_id=row.startup_id, role=row.role),
    )
    return {"user_id": str(row.id), "startup_id": str(row.startup_id), "email": email}


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@me_router.get("/me")
def me(principal: Principal = Depends(get_principal), conn: Connection = Depends(get_db)) -> dict:
    row = conn.execute(
        text(
            "SELECT u.id AS user_id, u.email, u.role, s.id AS startup_id, s.name AS startup_name, "
            "s.status, s.plan, s.trial_ends_at "
            "FROM users u JOIN startups s ON s.id = u.startup_id WHERE u.id = :uid"
        ),
        {"uid": str(principal.user_id)},
    ).mappings().first()
    if row is None:
        raise Unauthorized("Account no longer exists")
    return {k: (str(v) if k.endswith("_id") else v) for k, v in row.items()}
