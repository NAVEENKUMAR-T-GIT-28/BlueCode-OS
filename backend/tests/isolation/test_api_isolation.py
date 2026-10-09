"""API-level isolation: a logged-in tenant cannot see or touch another tenant's data,
and cannot influence which tenant a request runs as."""
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app


def signup(email_prefix: str) -> tuple[TestClient, dict]:
    client = TestClient(app)
    r = client.post("/api/v1/auth/signup", json={
        "startup_name": f"{email_prefix} Inc",
        "email": f"{email_prefix}-{uuid.uuid4().hex[:8]}@tenant-test.com",
        "password": "correct-horse-battery",
    })
    assert r.status_code == 201, r.text
    return client, r.json()


@pytest.fixture
def tenants(owner_engine):
    a_client, a = signup("alpha")
    b_client, b = signup("beta")
    a["job"] = seed_job(owner_engine, a["startup_id"])
    b["job"] = seed_job(owner_engine, b["startup_id"])
    return (a_client, a), (b_client, b)


def seed_job(owner_engine, startup_id, status="failed"):
    job_id = str(uuid.uuid4())
    with owner_engine.begin() as c:
        c.execute(text("INSERT INTO jobs (id, startup_id, type, status) "
                       "VALUES (:j, :s, 'discover', :st)"),
                  {"j": job_id, "s": startup_id, "st": status})
    return job_id


def test_cannot_read_another_tenants_job(tenants):
    (a_client, _), (_, b) = tenants
    r = a_client.get(f"/api/v1/jobs/{b['job']}")
    assert r.status_code == 404
    missing = a_client.get(f"/api/v1/jobs/{uuid.uuid4()}")
    assert missing.status_code == 404
    assert r.json() == missing.json()  # indistinguishable: IDs cannot be probed


def test_job_list_contains_only_own_jobs(tenants):
    (a_client, a), (_, b) = tenants
    ids = {j["id"] for j in a_client.get("/api/v1/jobs").json()}
    assert a["job"] in ids and b["job"] not in ids


def test_cannot_retry_another_tenants_job(tenants, owner_engine):
    (a_client, _), (_, b) = tenants
    assert a_client.post(f"/api/v1/jobs/{b['job']}/retry").status_code == 404
    with owner_engine.connect() as c:
        status = c.execute(text("SELECT status FROM jobs WHERE id = :j"), {"j": b["job"]}).scalar_one()
    assert status == "failed"  # untouched


def test_own_job_can_be_retried(tenants):
    (a_client, a), _ = tenants
    r = a_client.post(f"/api/v1/jobs/{a['job']}/retry")
    assert r.status_code == 200 and r.json()["status"] == "queued"
    assert a_client.post(f"/api/v1/jobs/{a['job']}/retry").status_code == 409  # now queued


def test_tenant_cannot_be_chosen_via_header_query_or_body(tenants):
    (a_client, a), (_, b) = tenants
    r = a_client.get(
        f"/api/v1/jobs?startup_id={b['startup_id']}",
        headers={"X-Startup-Id": b["startup_id"], "X-Tenant-Id": b["startup_id"]},
    )
    ids = {j["id"] for j in r.json()}
    assert a["job"] in ids and b["job"] not in ids


def test_me_and_usage_return_only_own_tenant(tenants):
    (a_client, a), (b_client, b) = tenants
    assert a_client.get("/api/v1/me").json()["startup_id"] == a["startup_id"]
    assert b_client.get("/api/v1/me").json()["startup_id"] == b["startup_id"]
    usage = a_client.get("/api/v1/usage").json()
    assert usage["cap_minor"] == 100000 and usage["remaining_minor"] == 100000


# ---- token tampering -------------------------------------------------------------

def make_token(startup_id, secret="test-secret-test-secret-test-secret-123", exp_minutes=60, **extra):
    now = datetime.now(UTC)
    payload = {"sub": str(uuid.uuid4()), "startup_id": startup_id, "role": "owner",
               "iat": now, "exp": now + timedelta(minutes=exp_minutes), **extra}
    return jwt.encode(payload, secret, algorithm="HS256")


def test_forged_token_for_another_tenant_is_rejected(tenants):
    _, (_, b) = tenants
    forged = make_token(b["startup_id"], secret="attacker-guess-attacker-guess-0000")
    r = TestClient(app).get("/api/v1/jobs", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_tampered_token_is_rejected(tenants):
    (a_client, _), _ = tenants
    token = a_client.cookies.get("access_token")
    tampered = token[:-3] + ("AAA" if not token.endswith("AAA") else "BBB")
    r = TestClient(app).get("/api/v1/jobs", headers={"Authorization": f"Bearer {tampered}"})
    assert r.status_code == 401


def test_expired_token_is_rejected(tenants):
    (_, a), _ = tenants
    expired = make_token(a["startup_id"], exp_minutes=-5)
    assert TestClient(app).get("/api/v1/jobs",
                               headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_token_without_tenant_claim_is_rejected():
    now = datetime.now(UTC)
    token = jwt.encode({"sub": str(uuid.uuid4()), "exp": now + timedelta(minutes=5)},
                       "test-secret-test-secret-test-secret-123", algorithm="HS256")
    assert TestClient(app).get("/api/v1/jobs",
                               headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_with_non_uuid_tenant_is_rejected():
    token = make_token("1' OR '1'='1")
    assert TestClient(app).get("/api/v1/jobs",
                               headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_valid_token_for_unknown_tenant_sees_nothing(tenants):
    forged_but_signed = make_token(str(uuid.uuid4()))
    r = TestClient(app).get("/api/v1/jobs", headers={"Authorization": f"Bearer {forged_but_signed}"})
    assert r.status_code == 200 and r.json() == []


@pytest.mark.parametrize("path", ["/api/v1/me", "/api/v1/usage", "/api/v1/jobs"])
def test_protected_routes_require_auth(path):
    r = TestClient(app).get(path)
    assert r.status_code == 401
    assert set(r.json()) == {"code", "message", "details"}
