"""Database-level tenant isolation. These prove RLS works even if application code is wrong.

Everything here connects as app_user / worker_user (never the owner), which is how
production connects. Tenant A is the 'current' tenant, B is the victim.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.db import tenant_conn

TENANT_TABLES = [
    "users", "icps", "prospects", "decision_makers", "leads",
    "outreach_history", "usage_tracker", "jobs",
]


def count(conn, sql, **params):
    return conn.execute(text(sql), params).scalar_one()


def test_runtime_roles_cannot_bypass_rls(owner_engine):
    with owner_engine.connect() as c:
        rows = c.execute(text(
            "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles "
            "WHERE rolname IN ('app_user', 'worker_user')"
        )).all()
    assert {r.rolname for r in rows} == {"app_user", "worker_user"}
    for r in rows:
        assert r.rolsuper is False and r.rolbypassrls is False


def test_rls_is_enabled_and_forced_on_every_table(owner_engine):
    with owner_engine.connect() as c:
        rows = c.execute(text(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
            "WHERE relname = ANY(:t)"), {"t": TENANT_TABLES + ["startups"]}).all()
    assert len(rows) == len(TENANT_TABLES) + 1
    for r in rows:
        assert r.relrowsecurity and r.relforcerowsecurity, f"RLS not forced on {r.relname}"


@pytest.mark.parametrize("table", TENANT_TABLES)
def test_tenant_sees_only_its_own_rows(app_engine, two_tenants, table):
    a, b = two_tenants
    with tenant_conn(app_engine, a["startup"]) as conn:
        assert count(conn, f"SELECT count(*) FROM {table} WHERE startup_id = :b", b=b["startup"]) == 0
        assert count(conn, f"SELECT count(*) FROM {table} WHERE startup_id = :a", a=a["startup"]) >= 1
        assert count(conn, f"SELECT count(*) FROM {table} WHERE startup_id <> :a", a=a["startup"]) == 0


def test_startups_table_shows_only_own_row(app_engine, two_tenants):
    a, _ = two_tenants
    with tenant_conn(app_engine, a["startup"]) as conn:
        ids = [str(r) for r in conn.execute(text("SELECT id FROM startups")).scalars()]
    assert ids == [a["startup"]]


@pytest.mark.parametrize("table", TENANT_TABLES + ["startups"])
def test_no_tenant_context_means_no_rows(app_engine, two_tenants, table):
    with app_engine.begin() as conn:
        assert count(conn, f"SELECT count(*) FROM {table}") == 0


def test_stale_setting_on_pooled_connection_is_harmless(app_engine, two_tenants):
    """set_config is transaction-local: the next transaction on the same connection sees nothing,
    and does not crash on an empty-string setting."""
    a, _ = two_tenants
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SELECT set_config('app.current_startup_id', :s, true)"),
                         {"s": a["startup"]})
            assert count(conn, "SELECT count(*) FROM leads") >= 1
        with conn.begin():
            assert count(conn, "SELECT count(*) FROM leads") == 0


@pytest.mark.parametrize("table,sql", [
    ("icps", "UPDATE icps SET product_description = 'hacked' WHERE startup_id = :b"),
    ("leads", "UPDATE leads SET suppressed = true WHERE startup_id = :b"),
    ("jobs", "UPDATE jobs SET status = 'failed' WHERE startup_id = :b"),
    ("usage_tracker", "UPDATE usage_tracker SET cap_minor = 999999999 WHERE startup_id = :b"),
])
def test_cannot_update_another_tenants_rows(app_engine, owner_engine, two_tenants, table, sql):
    a, b = two_tenants
    with tenant_conn(app_engine, a["startup"]) as conn:
        assert conn.execute(text(sql), {"b": b["startup"]}).rowcount == 0
    with owner_engine.connect() as c:  # victim's data is untouched
        assert count(c, f"SELECT count(*) FROM {table} WHERE startup_id = :b", b=b["startup"]) >= 1


def test_cannot_insert_rows_for_another_tenant(app_engine, two_tenants):
    a, b = two_tenants
    with pytest.raises(DBAPIError) as exc:
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text(
                "INSERT INTO icps (startup_id, product_description, criteria_json) "
                "VALUES (:b, 'x', CAST('{}' AS jsonb))"), {"b": b["startup"]})
    assert "row-level security" in str(exc.value)

    with pytest.raises(DBAPIError) as exc:
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text("INSERT INTO jobs (startup_id, type) VALUES (:b, 'discover')"),
                         {"b": b["startup"]})
    assert "row-level security" in str(exc.value)


def test_cannot_move_own_row_to_another_tenant(app_engine, two_tenants):
    a, b = two_tenants
    with pytest.raises(DBAPIError) as exc:
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text("UPDATE icps SET startup_id = :b WHERE startup_id = :a"),
                         {"a": a["startup"], "b": b["startup"]})
    assert "row-level security" in str(exc.value)


def test_foreign_keys_cannot_cross_tenants(app_engine, two_tenants):
    """Tenant A cannot attach a lead to tenant B's prospect/decision maker (composite FKs)."""
    a, b = two_tenants
    with pytest.raises(IntegrityError):
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text(
                "INSERT INTO leads (startup_id, prospect_id, dm_id) VALUES (:a, :bp, :ad)"),
                {"a": a["startup"], "bp": b["prospect"], "ad": a["dm"]})
    with pytest.raises(IntegrityError):
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text(
                "INSERT INTO outreach_history (startup_id, lead_id, direction, kind, body, status) "
                "VALUES (:a, :bl, 'outbound', 'cold_email', 'x', 'draft')"),
                {"a": a["startup"], "bl": b["lead"]})


def test_login_lookup_policy_exposes_only_the_matching_user(app_engine, two_tenants):
    a, b = two_tenants
    with app_engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.auth_email', :e, true)"), {"e": a["email"]})
        emails = list(conn.execute(text("SELECT email FROM users")).scalars())
    assert emails == [a["email"]]
    # The lookup policy is SELECT-only: it grants no write access at all.
    with app_engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.auth_email', :e, true)"), {"e": a["email"]})
        updated = conn.execute(
            text("UPDATE users SET role = 'member' WHERE email = :e"), {"e": a["email"]}
        ).rowcount
        assert updated == 0
    with pytest.raises(DBAPIError):
        with app_engine.begin() as conn:
            conn.execute(text("SELECT set_config('app.auth_email', :e, true)"), {"e": a["email"]})
            conn.execute(text("INSERT INTO users (startup_id, email, password_hash) "
                              "VALUES (:s, 'x@y.com', 'h')"), {"s": b["startup"]})


def test_worker_role_spans_tenants_for_jobs_only(worker_engine, two_tenants):
    a, b = two_tenants
    with worker_engine.begin() as conn:
        seen = {str(s) for s in conn.execute(text("SELECT startup_id FROM jobs")).scalars()}
        assert {a["startup"], b["startup"]} <= seen
        for table in ["users", "icps", "prospects", "decision_makers", "leads",
                      "outreach_history", "usage_tracker", "startups"]:
            assert count(conn, f"SELECT count(*) FROM {table}") == 0, table
    with tenant_conn(worker_engine, a["startup"]) as conn:  # with context it works like app_user
        assert count(conn, "SELECT count(*) FROM leads WHERE startup_id = :b", b=b["startup"]) == 0
        assert count(conn, "SELECT count(*) FROM leads") >= 1


def test_usage_cap_check_constraint(app_engine, two_tenants):
    a, _ = two_tenants
    with pytest.raises(IntegrityError):
        with tenant_conn(app_engine, a["startup"]) as conn:
            conn.execute(text("UPDATE usage_tracker SET spent_minor = cap_minor + 1"))
