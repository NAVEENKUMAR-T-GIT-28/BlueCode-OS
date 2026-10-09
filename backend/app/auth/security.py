import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings
from app.core.errors import Unauthorized

ALGORITHM = "HS256"
_hasher = PasswordHasher()

# Verified against when the email is unknown, so response time does not reveal
# which emails exist.
DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(*, user_id: uuid.UUID, startup_id: uuid.UUID, role: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "startup_id": str(startup_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=s.jwt_expire_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "startup_id"]},
        )
        uuid.UUID(payload["sub"])
        uuid.UUID(payload["startup_id"])
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise Unauthorized("Invalid or expired session") from exc
    return payload
