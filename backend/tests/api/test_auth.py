import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app

BASE = "/api/v1/auth"
PASSWORD = "correct-horse-battery"


def new_email() -> str:
    return f"user-{uuid.uuid4().hex[:10]}@auth-test.com"


@pytest.fixture
def client():
    return TestClient(app)


def signup(client, email=None, password=PASSWORD, name="Acme Labs"):
    return client.post(f"{BASE}/signup",
                       json={"startup_name": name, "email": email or new_email(), "password": password})


def test_signup_creates_trial_tenant_with_cap(client, owner_engine):
    email = new_email()
    r = signup(client, email)
    assert r.status_code == 201
    body = r.json()
    ends = datetime.fromisoformat(body["trial_ends_at"])
    assert timedelta(days=14, hours=23) < ends - datetime.now(UTC) < timedelta(days=15, hours=1)
    assert "access_token" in client.cookies

    with owner_engine.connect() as c:
        s = c.execute(text("SELECT plan, status FROM startups WHERE id = :i"),
                      {"i": body["startup_id"]}).one()
        u = c.execute(text("SELECT cap_minor, spent_minor FROM usage_tracker WHERE startup_id = :i"),
                      {"i": body["startup_id"]}).one()
        pw = c.execute(text("SELECT password_hash FROM users WHERE email = :e"), {"e": email}).scalar_one()
    assert (s.plan, s.status) == ("pilot", "trial")
    assert (u.cap_minor, u.spent_minor) == (100000, 0)  # Rs 1,000 hard cap
    assert pw.startswith("$argon2") and PASSWORD not in pw


def test_session_cookie_flags(client):
    r = signup(client)
    header = r.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header
    assert PASSWORD not in r.text


def test_duplicate_email_conflicts_case_insensitively(client):
    email = new_email()
    assert signup(client, email).status_code == 201
    r = signup(TestClient(app), email.upper())
    assert r.status_code == 409 and r.json()["code"] == "email_taken"


@pytest.mark.parametrize("payload", [
    {"startup_name": "", "email": "a@auth-test.com", "password": "longenough1"},
    {"startup_name": "X", "email": "not-an-email", "password": "longenough1"},
    {"startup_name": "X", "email": "a@auth-test.com", "password": "short"},
])
def test_signup_validation(client, payload):
    r = client.post(f"{BASE}/signup", json=payload)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_login_success_then_me(client):
    email = new_email()
    signup(client, email)
    other = TestClient(app)
    r = other.post(f"{BASE}/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200
    me = other.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["email"] == email and me.json()["role"] == "owner"
    assert me.json()["status"] == "trial"


def test_login_wrong_password_and_unknown_email_look_identical(client):
    email = new_email()
    signup(client, email)
    wrong = TestClient(app).post(f"{BASE}/login", json={"email": email, "password": "nope-nope-nope"})
    unknown = TestClient(app).post(f"{BASE}/login",
                                   json={"email": new_email(), "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_login_throttle_after_five_failures(client):
    email = new_email()
    signup(client, email)
    c = TestClient(app)
    for _ in range(5):
        assert c.post(f"{BASE}/login", json={"email": email, "password": "bad-bad-bad"}).status_code == 401
    r = c.post(f"{BASE}/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 429  # even the right password is refused while throttled


def test_logout_clears_session(client):
    signup(client)
    assert client.get("/api/v1/me").status_code == 200
    assert client.post(f"{BASE}/logout").status_code == 204
    assert client.get("/api/v1/me").status_code == 401


def test_suspended_account_cannot_login(client, owner_engine):
    email = new_email()
    body = signup(client, email).json()
    with owner_engine.begin() as c:
        c.execute(text("UPDATE startups SET status = 'suspended' WHERE id = :i"), {"i": body["startup_id"]})
    r = TestClient(app).post(f"{BASE}/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 403 and r.json()["code"] == "account_suspended"


def test_healthz():
    r = TestClient(app).get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
