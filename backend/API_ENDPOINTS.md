# BlueCode OS – API Endpoint Reference

> **Base URL (dev):** `http://localhost:4000`  
> **All responses** use the envelope `{ "data": … }` on success and `{ "code": "…", "message": "…" }` on error.  
> **Auth:** session is stored in an `httpOnly` cookie `bc_session` (set automatically on login).  
> **CSRF guard:** non-GET requests from a browser must include the header `x-requested-with: XMLHttpRequest`.  
> **Rate limit (auth routes):** 10 requests per 15 min per IP.

---

## 0. Health Check

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/health` |
| **Auth required** | No |

### Response `200`
```json
{
  "data": {
    "status": "ok",
    "time": "2026-10-11T07:00:00.000Z"
  }
}
```

### curl
```bash
curl http://localhost:4000/health
```

---

## 1. Auth — Register

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/register` |
| **Auth required** | No |
| **Rate limited** | Yes (10 / 15 min) |

### Request Body (`application/json`)
```json
{
  "name": "Alice Founder",
  "email": "alice@example.com",
  "password": "strongpassword1"
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–80 chars, trimmed |
| `email` | string | valid email, max 254 chars, lowercased |
| `password` | string | 10–128 chars |

> Extra fields are **rejected** (strict schema).

### Response `201`
```json
{
  "data": {
    "id": "664f...",
    "name": "Alice Founder",
    "email": "alice@example.com",
    "status": "active",
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields or extra fields |
| 409 | `CONFLICT` | Email already registered |
| 429 | `RATE_LIMIT` | Too many requests |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -d '{"name":"Alice Founder","email":"alice@example.com","password":"strongpassword1"}'
```

---

## 2. Auth — Login

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/login` |
| **Auth required** | No |
| **Rate limited** | Yes (10 / 15 min) |

### Request Body (`application/json`)
```json
{
  "email": "alice@example.com",
  "password": "strongpassword1"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | string | valid email, max 254 chars |
| `password` | string | 1–128 chars |

### Response `200`
Sets cookie: **`bc_session`** (httpOnly, SameSite=Lax, path=/)

```json
{
  "data": {
    "user": {
      "id": "664f...",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "status": "active",
      "createdAt": "2026-10-11T07:00:00.000Z"
    },
    "memberships": [
      {
        "startupId": "665a...",
        "role": "owner",
        "status": "active"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 429 | `RATE_LIMIT` | Too many requests |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -c cookies.txt \
  -d '{"email":"alice@example.com","password":"strongpassword1"}'
```
> `-c cookies.txt` saves the session cookie for subsequent requests.

---

## 3. Auth — Get Current User (`/me`)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/auth/me` |
| **Auth required** | **Yes** — `bc_session` cookie |

### Response `200`
```json
{
  "data": {
    "user": {
      "id": "664f...",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "status": "active",
      "createdAt": "2026-10-11T07:00:00.000Z"
    },
    "memberships": [
      {
        "startupId": "665a...",
        "role": "owner",
        "status": "active"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |

### curl
```bash
curl http://localhost:4000/api/v1/auth/me \
  -b cookies.txt
```

---

## 4. Auth — Logout

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/logout` |
| **Auth required** | No (clears cookie regardless) |

### Response `204`
*(empty body — clears `bc_session` cookie)*

### curl
```bash
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt -c cookies.txt
```

---

## 5. Startups — List My Startups

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/startups` |
| **Auth required** | **Yes** — `bc_session` cookie |

### Response `200`
```json
{
  "data": {
    "startups": [
      {
        "startupId": "665a...",
        "role": "owner",
        "status": "active"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |

### curl
```bash
curl http://localhost:4000/api/v1/startups \
  -b cookies.txt
```

---

## 6. Startups — Create Startup

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/startups` |
| **Auth required** | **Yes** — `bc_session` cookie |

### Request Body (`application/json`)
```json
{
  "name": "Acme AI"
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–80 chars, trimmed |

> Extra fields are **rejected** (strict schema).

### Response `201`
```json
{
  "data": {
    "id": "665a...",
    "name": "Acme AI",
    "plan": "trial",
    "status": "active",
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/startups \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"name":"Acme AI"}'
```

---

## 7. Startups — Get Current Startup (with spend + permissions)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/startups/current` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |

### Request Headers
```
x-startup-id: 665a...
```

### Response `200`
```json
{
  "data": {
    "startup": {
      "id": "665a...",
      "name": "Acme AI",
      "plan": "trial",
      "status": "active",
      "trialEndsAt": "2026-11-10T07:00:00.000Z",
      "settings": {},
      "spend": {
        "capPaise": 25000,
        "committedPaise": 0,
        "reservedPaise": 0,
        "remainingPaise": 25000
      },
      "me": {
        "role": "owner",
        "permissions": ["startup:read", "startup:write", "members:read"]
      },
      "capabilities": {
        "searchOrgs": false,
        "searchPeople": false,
        "enrich": false
      },
      "createdAt": "2026-10-11T07:00:00.000Z"
    }
  }
}
```

> **`spend.capPaise`** is always `25000` (Rs.250) — frozen per design decision D5.
> **`capabilities`** are all `false` until Apollo account + commercial permissions are verified.

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MISSING_TENANT` | `x-startup-id` header absent or empty |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | User is not a member of that startup |
| 404 | `NOT_FOUND` | Startup does not exist |

### curl
```bash
curl http://localhost:4000/api/v1/startups/current \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## Quick Reference Table

| # | Method | URL | Auth | Purpose |
|---|---|---|---|---|
| 0 | `GET` | `/health` | — | Server liveness |
| 1 | `POST` | `/api/v1/auth/register` | — | Create account |
| 2 | `POST` | `/api/v1/auth/login` | — | Login, sets cookie |
| 3 | `GET` | `/api/v1/auth/me` | Cookie | Session info + memberships |
| 4 | `POST` | `/api/v1/auth/logout` | — | Clear session cookie |
| 5 | `GET` | `/api/v1/startups` | Cookie | List my startups |
| 6 | `POST` | `/api/v1/startups` | Cookie | Create new startup |
| 7 | `GET` | `/api/v1/startups/current` | Cookie + `x-startup-id` | Current startup detail + spend |

---

## Testing Flow (in order)

```bash
# 1. Health check
curl http://localhost:4000/health

# 2. Register
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -d '{"name":"Alice Founder","email":"alice@example.com","password":"strongpassword1"}'

# 3. Login (saves cookie to cookies.txt)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -c cookies.txt \
  -d '{"email":"alice@example.com","password":"strongpassword1"}'

# 4. Get session info
curl http://localhost:4000/api/v1/auth/me -b cookies.txt

# 5. Create a startup
curl -X POST http://localhost:4000/api/v1/startups \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"name":"Acme AI"}'

# 6. List startups
curl http://localhost:4000/api/v1/startups -b cookies.txt

# 7. Get current startup (replace ID from step 5 response)
curl http://localhost:4000/api/v1/startups/current \
  -H "x-startup-id: <id-from-step-5>" \
  -b cookies.txt

# 8. Logout
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt -c cookies.txt
```
