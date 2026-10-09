import pytest
from sqlalchemy import text

from app.config import get_settings
from app.core.crypto import DecryptionFailed, decrypt_for
from tests.api.helpers import signup

MAILBOX = {"host": "smtp.example.com", "port": 465, "username": "me@startup.com",
           "password": "hunter2-hunter2", "security": "ssl"}


@pytest.fixture
def founder():
    return signup("settings")


def test_defaults(founder):
    client, _ = founder
    r = client.get("/api/v1/settings")
    assert r.status_code == 200
    body = r.json()
    assert body["smtp"] == {"configured": False} and body["imap"] == {"configured": False}
    assert body["plan"] == "pilot" and body["status"] == "trial" and body["booking_link"] is None


def test_mailbox_is_encrypted_at_rest_and_the_password_never_returned(founder, owner_engine):
    client, ids = founder
    r = client.put("/api/v1/settings", json={"smtp": MAILBOX, "imap": {**MAILBOX, "host": "imap.example.com", "port": 993}})
    assert r.status_code == 200
    assert "hunter2" not in r.text
    assert r.json()["smtp"] == {"configured": True, "readable": True, "host": "smtp.example.com",
                                "port": 465, "username": "me@startup.com", "security": "ssl"}
    assert "hunter2" not in client.get("/api/v1/settings").text

    with owner_engine.connect() as c:
        blob = c.execute(text("SELECT smtp_config_enc FROM startups WHERE id=:i"),
                         {"i": ids["startup_id"]}).scalar_one()
    assert b"hunter2" not in bytes(blob) and b"smtp.example.com" not in bytes(blob)
    assert decrypt_for(ids["startup_id"], "smtp", blob)["password"] == "hunter2-hunter2"
    with pytest.raises(DecryptionFailed):  # a blob copied to another tenant is useless there
        decrypt_for("00000000-0000-0000-0000-000000000000", "smtp", blob)
    with pytest.raises(DecryptionFailed):  # and cannot be reused as the IMAP secret
        decrypt_for(ids["startup_id"], "imap", blob)


def test_without_an_encryption_key_mailbox_saving_is_refused(founder, monkeypatch):
    client, _ = founder
    monkeypatch.setattr(get_settings(), "app_encryption_key", "")
    r = client.put("/api/v1/settings", json={"smtp": MAILBOX})
    assert r.status_code == 503 and r.json()["code"] == "encryption_not_configured"
    assert client.get("/api/v1/settings").json()["smtp"] == {"configured": False}


def test_partial_updates_leave_other_fields_alone(founder):
    client, _ = founder
    client.put("/api/v1/settings", json={"smtp": MAILBOX, "sender_name": "Asha"})
    r = client.put("/api/v1/settings", json={"booking_link": "https://calendly.com/asha/intro"})
    body = r.json()
    assert body["booking_link"] == "https://calendly.com/asha/intro"
    assert body["sender_name"] == "Asha" and body["smtp"]["configured"] is True


def test_fields_can_be_cleared_with_null(founder):
    client, _ = founder
    client.put("/api/v1/settings", json={"smtp": MAILBOX, "booking_link": "https://calendly.com/a/b"})
    body = client.put("/api/v1/settings", json={"smtp": None, "booking_link": None}).json()
    assert body["smtp"] == {"configured": False} and body["booking_link"] is None


@pytest.mark.parametrize("payload", [
    {"booking_link": "http://calendly.com/a/b"},
    {"booking_link": "calendly.com/a/b"},
    {"booking_link": "https://exa mple.com"},
    {"smtp": {**MAILBOX, "host": "https://smtp.example.com"}},
    {"smtp": {**MAILBOX, "port": 70000}},
    {"smtp": {**MAILBOX, "password": ""}},
    {"smtp": {**MAILBOX, "security": "plaintext"}},
    {"company_name": ""},
])
def test_invalid_input_is_rejected(founder, payload):
    client, _ = founder
    r = client.put("/api/v1/settings", json=payload)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_company_name_change_shows_up_in_me(founder):
    client, _ = founder
    client.put("/api/v1/settings", json={"company_name": "  Renamed Labs  "})
    assert client.get("/api/v1/me").json()["startup_name"] == "Renamed Labs"


def test_settings_are_per_tenant(founder):
    a, _ = founder
    b, _ = signup("other")
    a.put("/api/v1/settings", json={"smtp": MAILBOX, "booking_link": "https://calendly.com/a/b"})
    seen_by_b = b.get("/api/v1/settings").json()
    assert seen_by_b["smtp"] == {"configured": False} and seen_by_b["booking_link"] is None


def test_requires_login():
    from fastapi.testclient import TestClient

    from app.main import app
    c = TestClient(app)
    assert c.get("/api/v1/settings").status_code == 401
    assert c.put("/api/v1/settings", json={}).status_code == 401
