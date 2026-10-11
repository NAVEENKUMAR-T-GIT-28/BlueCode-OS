# BlueCode OS – API Endpoint Reference

> **Base URL (dev):** `http://localhost:4000`  
> **All responses** use the envelope `{ "data": … }` on success and `{ "code": "…", "message": "…" }` on error.  
> **Auth:** session is stored in an `httpOnly` cookie `bc_session` (set automatically on login).  
> **Tenant identification:** all workspace-scoped endpoints require the header `x-startup-id: <startupId>`.  
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
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

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
        "permissions": [
          "workspace:read",
          "workspace:settings",
          "member:invite",
          "member:role",
          "icp:write",
          "prospect:search",
          "prospect:score",
          "prospect:mark_dnc",
          "prospect:clear_dnc"
        ]
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

> **`spend.capPaise`** is frozen at `25000` (₹250) for the trial plan per system safety controls.  
> **`capabilities`** reflect Apollo integration status (all disabled until verified).

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

## 8. Startups — Update Current Startup (Settings)

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/startups/current` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:settings` (`owner`, `admin`) |

### Request Body (`application/json`)
```json
{
  "name": "Acme AI Corp",
  "settings": {
    "calendarLink": "https://cal.com/acme/demo",
    "senderName": "Alice Founder",
    "senderTitle": "CEO & Founder",
    "productSummary": "AI sales agent platform for high-velocity SDR teams"
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–80 chars, optional |
| `settings` | object | optional, strict (rejects extra fields) |
| `settings.calendarLink` | string | valid HTTPS url, max 200 chars, optional |
| `settings.senderName` | string | 1–200 chars, optional |
| `settings.senderTitle` | string | 1–200 chars, optional |
| `settings.productSummary` | string | 1–1000 chars, optional |

> At least one of `name` or `settings` must be provided. At least one sub-field must be supplied when `settings` is present.

### Response `200`
```json
{
  "data": {
    "startup": {
      "id": "665a...",
      "name": "Acme AI Corp",
      "plan": "trial",
      "status": "active",
      "trialEndsAt": "2026-11-10T07:00:00.000Z",
      "settings": {
        "calendarLink": "https://cal.com/acme/demo",
        "senderName": "Alice Founder",
        "senderTitle": "CEO & Founder",
        "productSummary": "AI sales agent platform for high-velocity SDR teams"
      },
      "spend": {
        "capPaise": 25000,
        "committedPaise": 0,
        "reservedPaise": 0,
        "remainingPaise": 25000
      },
      "me": {
        "role": "owner",
        "permissions": [
          "workspace:read",
          "workspace:settings",
          "member:invite",
          "member:role",
          "icp:write",
          "prospect:search",
          "prospect:score",
          "prospect:mark_dnc",
          "prospect:clear_dnc"
        ]
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

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Non-HTTPS calendar link, extra fields, or invalid length |
| 400 | `MISSING_TENANT` | `x-startup-id` header absent or empty |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | Missing `workspace:settings` permission (members) |
| 404 | `NOT_FOUND` | Startup does not exist |

### curl
```bash
curl -X PATCH http://localhost:4000/api/v1/startups/current \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"name":"Acme AI Corp","settings":{"calendarLink":"https://cal.com/acme/demo","senderName":"Alice Founder"}}'
```

---

## 9. Startups — List Workspace Members

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/startups/current/members` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

### Response `200`
```json
{
  "data": [
    {
      "id": "665b1...",
      "userId": "664f0...",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "role": "owner",
      "status": "active"
    },
    {
      "id": "665b2...",
      "userId": "664f9...",
      "name": "Bob Teammate",
      "email": "bob@example.com",
      "role": "admin",
      "status": "active"
    }
  ]
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MISSING_TENANT` | `x-startup-id` header absent or empty |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | Not a member of this startup |

### curl
```bash
curl http://localhost:4000/api/v1/startups/current/members \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 10. Startups — Invite Member

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/startups/current/members` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `member:invite` (`owner`, `admin`) |

### Request Body (`application/json`)
```json
{
  "email": "bob@example.com",
  "role": "admin"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | string | valid email, max 254 chars |
| `role` | string | `'admin'` or `'member'` |

> **Notes:**
> - The invitee must already have a registered account in BlueCode OS.
> - The trial plan has a 1-member limit. Inviting additional members returns `402 PLAN_LIMIT_REACHED`.

### Response `201`
```json
{
  "data": {
    "id": "665b2...",
    "userId": "664f9...",
    "name": "Bob Teammate",
    "email": "bob@example.com",
    "role": "admin",
    "status": "active"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid email, invalid role, or extra fields |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 402 | `PLAN_LIMIT_REACHED` | Trial plan seat limit reached (1 member max) |
| 403 | `FORBIDDEN` | Missing `member:invite` permission |
| 404 | `NOT_FOUND` | No registered user found for email |
| 409 | `CONFLICT` | User already has a membership or invitation in this startup |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/startups/current/members \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"email":"bob@example.com","role":"admin"}'
```

---

## 11. Startups — Update Member Role

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/startups/current/members/:memberId` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `member:role` (`owner`, `admin`) |

### Request Body (`application/json`)
```json
{
  "role": "member"
}
```

| Field | Type | Rules |
|---|---|---|
| `role` | string | `'owner'`, `'admin'`, or `'member'` |

### Response `200`
```json
{
  "data": {
    "id": "665b2...",
    "userId": "664f9...",
    "name": "Bob Teammate",
    "email": "bob@example.com",
    "role": "member",
    "status": "active"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid role value or extra fields |
| 400 | `MALFORMED_REQUEST` | `memberId` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | Missing `member:role` permission |
| 404 | `NOT_FOUND` | Member not found |
| 409 | `INVALID_STATE` | Member is removed, or attempting to demote the last active owner |

### curl
```bash
curl -X PATCH http://localhost:4000/api/v1/startups/current/members/665b2... \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"role":"member"}'
```

---

## 12. Startups — Remove Member

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/startups/current/members/:memberId` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `member:role` (`owner`, `admin`) |

> **Audit Integrity:** Soft-delete only. Member status transitions to `removed`. Records are never physically deleted.

### Response `204`
*(empty body)*

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | `memberId` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | Missing `member:role` permission |
| 404 | `NOT_FOUND` | Member not found |
| 409 | `INVALID_STATE` | Cannot remove the last active owner |

### curl
```bash
curl -X DELETE http://localhost:4000/api/v1/startups/current/members/665b2... \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 13. ICP — Create Ideal Customer Profile

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/icps` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `icp:write` (`owner`, `admin`, `member`) |

### Request Body (`application/json`)
```json
{
  "name": "Series A AI Startups",
  "criteria": {
    "industries": ["Software Development", "Artificial Intelligence"],
    "countries": ["United States", "Canada"],
    "employeeRanges": ["11-50", "51-200"],
    "technologies": ["TypeScript", "Python", "Kubernetes"],
    "targetJobTitles": ["VP Engineering", "CTO", "Head of AI"],
    "targetSeniority": ["director", "executive", "vp"]
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–80 chars, trimmed |
| `criteria` | object | strict criteria map (up to 25 items per array, no duplicate strings case-insensitive) |
| `criteria.industries` | string[] | optional, strings 1–80 chars |
| `criteria.countries` | string[] | optional, strings 1–80 chars |
| `criteria.regions` | string[] | optional, strings 1–80 chars |
| `criteria.employeeRanges` | string[] | optional, strings 1–80 chars |
| `criteria.revenueRanges` | string[] | optional, strings 1–80 chars |
| `criteria.technologies` | string[] | optional, strings 1–80 chars |
| `criteria.companyKeywords` | string[] | optional, strings 1–80 chars |
| `criteria.excludedIndustries` | string[] | optional, strings 1–80 chars |
| `criteria.excludedCompanies` | string[] | optional, strings 1–80 chars |
| `criteria.targetJobTitles` | string[] | optional, strings 1–80 chars |
| `criteria.targetSeniority` | string[] | optional, strings 1–80 chars |
| `criteria.contactLocations` | string[] | optional, strings 1–80 chars |

### Response `201`
```json
{
  "data": {
    "id": "665c1...",
    "name": "Series A AI Startups",
    "criteria": {
      "industries": ["Software Development", "Artificial Intelligence"],
      "countries": ["United States", "Canada"],
      "employeeRanges": ["11-50", "51-200"],
      "technologies": ["TypeScript", "Python", "Kubernetes"],
      "targetJobTitles": ["VP Engineering", "CTO", "Head of AI"],
      "targetSeniority": ["director", "executive", "vp"]
    },
    "criteriaVersion": 1,
    "isActive": true,
    "createdBy": "664f0...",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:00:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing name, duplicate entries in criteria, or extra fields |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 402 | `PLAN_LIMIT_REACHED` | Trial plan allows max 1 active ICP |
| 403 | `FORBIDDEN` | Missing `icp:write` permission |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/icps \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"name":"Series A AI Startups","criteria":{"industries":["Software Development"],"targetJobTitles":["VP Engineering"]}}'
```

---

## 14. ICP — List ICPs

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/icps` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

### Query Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `isActive` | string | *(all)* | Filter by active state: `"true"` or `"false"` |
| `sort` | string | `"-createdAt"` | Sort order: `"createdAt"` or `"-createdAt"` |
| `page` | integer | `1` | Page number (>= 1) |
| `limit` | integer | `20` | Page size (1..100) |

### Response `200`
```json
{
  "data": [
    {
      "id": "665c1...",
      "name": "Series A AI Startups",
      "criteria": {
        "industries": ["Software Development"]
      },
      "criteriaVersion": 1,
      "isActive": true,
      "createdBy": "664f0...",
      "createdAt": "2026-10-11T07:00:00.000Z",
      "updatedAt": "2026-10-11T07:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### curl
```bash
curl "http://localhost:4000/api/v1/icps?isActive=true&page=1&limit=10" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 15. ICP — Get ICP by ID

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/icps/:id` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

### Response `200`
```json
{
  "data": {
    "id": "665c1...",
    "name": "Series A AI Startups",
    "criteria": {
      "industries": ["Software Development"],
      "targetJobTitles": ["VP Engineering"]
    },
    "criteriaVersion": 1,
    "isActive": true,
    "createdBy": "664f0...",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:00:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | `id` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | ICP not found in this workspace |

### curl
```bash
curl http://localhost:4000/api/v1/icps/665c1... \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 16. ICP — Update ICP

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/icps/:id` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `icp:write` (`owner`, `admin`, `member`) |

> Updating `criteria` increments `criteriaVersion`. Past scores preserve immutable audit linkage to their original criteria version.

### Request Body (`application/json`)
```json
{
  "name": "Series A & B AI Startups",
  "criteria": {
    "industries": ["Software Development", "Artificial Intelligence"]
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–80 chars, optional |
| `criteria` | object | criteria map, optional |

> At least one of `name` or `criteria` must be provided.

### Response `200`
```json
{
  "data": {
    "id": "665c1...",
    "name": "Series A & B AI Startups",
    "criteria": {
      "industries": ["Software Development", "Artificial Intelligence"]
    },
    "criteriaVersion": 2,
    "isActive": true,
    "createdBy": "664f0...",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:30:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Empty body, duplicate array items, or extra fields |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | ICP not found in this workspace |
| 409 | `INVALID_STATE` | Cannot update an archived ICP |

### curl
```bash
curl -X PATCH http://localhost:4000/api/v1/icps/665c1... \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"name":"Series A & B AI Startups"}'
```

---

## 17. ICP — Archive ICP

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/icps/:id/archive` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `icp:write` (`owner`, `admin`, `member`) |

> Soft-delete: sets `isActive: false`. Archived ICPs cannot be used for new scoring (`409 INVALID_STATE`).

### Response `204`
*(empty body)*

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | `id` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | ICP not found in this workspace |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/icps/665c1.../archive \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 18. Prospects — Search Prospects (Live Discovery)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/search` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:search` (`owner`, `admin`, `member`) |

### Request Body (`application/json`)
```json
{
  "icpId": "665c1...",
  "page": 1,
  "perPage": 25
}
```

| Field | Type | Rules |
|---|---|---|
| `icpId` | string | 24-character ObjectId |
| `page` | integer | optional, >= 1 (default 1) |
| `perPage` | integer | optional, 1..25 (default 25) |

> **Capability Guard:** Live external Apollo organization discovery is disabled by commercial safety controls until outbound credentials and capabilities are verified.

### Response `503` (Capability Disabled)
```json
{
  "code": "CAPABILITY_DISABLED",
  "message": "Organization search is disabled until the Apollo capability is verified and enabled",
  "details": {
    "capability": "search_orgs"
  }
}
```

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/search \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"icpId":"665c1..."}'
```

---

## 19. Prospects — List Prospects

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/prospects` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

### Query Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `icpId` | string | *(all)* | Filter by origin ICP ID |
| `scoredAgainstIcpId` | string | *(all)* | Filter by the ICP used in scoring |
| `status` | string | *(all)* | `'discovered'`, `'qualified'`, `'disqualified'`, or `'do_not_contact'` |
| `category` | string | *(all)* | Comma-separated categories: `'hot,high,medium,low'` |
| `minScore` | integer | *(none)* | Minimum score threshold (0..100) |
| `q` | string | *(none)* | Substring search across company name and domain |
| `includeLow` | string | `"false"` | Include prospects with score category `'low'` |
| `sort` | string | `"-createdAt"` | `'score'`, `'-score'`, `'createdAt'`, `'-createdAt'`, `'name'` |
| `page` | integer | `1` | Page number (>= 1) |
| `limit` | integer | `20` | Page size (1..100) |

### Response `200`
```json
{
  "data": [
    {
      "id": "665d1...",
      "icpId": "665c1...",
      "name": "Apex AI Inc",
      "domain": "apexai.io",
      "status": "discovered",
      "firmographics": {
        "industry": "Software Development",
        "country": "United States",
        "employeeCount": 65,
        "keywords": ["ai", "machine learning"]
      },
      "latestScore": {
        "icpId": "665c1...",
        "score": 86,
        "category": "hot",
        "coverage": 0.82,
        "scoredAt": "2026-10-11T07:00:00.000Z"
      },
      "createdAt": "2026-10-11T07:00:00.000Z",
      "updatedAt": "2026-10-11T07:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### curl
```bash
curl "http://localhost:4000/api/v1/prospects?status=discovered&category=hot,high&sort=-score&page=1&limit=10" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 20. Prospects — Select & Qualify Prospects (Batch)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/select` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:search` (`owner`, `admin`, `member`) |

> Transitions selected prospects from `discovered` to `qualified` and writes an audit event to `sales_activities`. If any ID in `prospectIds` does not belong to the workspace, the entire batch fails (`422 VALIDATION_FAILED`) with zero side effects.

### Request Body (`application/json`)
```json
{
  "prospectIds": [
    "665d1...",
    "665d2..."
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `prospectIds` | string[] | array of 1..50 24-character ObjectIds |

### Response `200`
```json
{
  "data": {
    "updated": 1,
    "skipped": [
      {
        "id": "665d2...",
        "reason": "already_qualified"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Empty array, invalid ObjectId format, or > 50 IDs |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 422 | `VALIDATION_FAILED` | One or more prospect IDs do not belong to this workspace |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/select \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"prospectIds":["665d1..."]}'
```

---

## 21. Prospects — Get Prospect Detail

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/prospects/:id` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

> Returns complete prospect details: firmographics, scored ICP summaries, buying signals (automatically flagged stale if older than 45 days), decision-maker contacts, and recent sales activities.

### Response `200`
```json
{
  "data": {
    "prospect": {
      "id": "665d1...",
      "icpId": "665c1...",
      "name": "Apex AI Inc",
      "domain": "apexai.io",
      "status": "qualified",
      "firmographics": {
        "industry": "Software Development",
        "country": "United States",
        "employeeCount": 65,
        "keywords": ["ai", "machine learning"]
      },
      "latestScore": {
        "icpId": "665c1...",
        "score": 86,
        "category": "hot",
        "coverage": 0.82,
        "scoredAt": "2026-10-11T07:00:00.000Z"
      },
      "createdAt": "2026-10-11T07:00:00.000Z",
      "updatedAt": "2026-10-11T07:10:00.000Z"
    },
    "scores": [
      {
        "icpId": "665c1...",
        "latest": {
          "id": "665e1...",
          "prospectId": "665d1...",
          "icpId": "665c1...",
          "score": 86,
          "category": "hot",
          "coverage": 0.82,
          "breakdown": {
            "firmographics": 40,
            "jobTitles": 26,
            "signals": 20,
            "penalties": 0
          },
          "explanation": "Strong match on industry (Software Development) and employee count (65).",
          "explanationSource": "rule_based",
          "scoringVersion": "deterministic-v1",
          "icpVersion": 1,
          "scoredAt": "2026-10-11T07:00:00.000Z",
          "createdAt": "2026-10-11T07:00:00.000Z"
        }
      }
    ],
    "signals": [
      {
        "id": "665e2...",
        "prospectId": "665d1...",
        "signalType": "hiring_expansion",
        "description": "Posted 4 senior backend engineering roles in past 30 days",
        "evidence": "Careers page",
        "confidence": 0.9,
        "status": "active",
        "detectedAt": "2026-10-10T12:00:00.000Z",
        "createdAt": "2026-10-10T12:00:00.000Z",
        "updatedAt": "2026-10-10T12:00:00.000Z"
      }
    ],
    "contacts": [
      {
        "id": "665e3...",
        "prospectId": "665d1...",
        "fullName": "Sarah Connor",
        "jobTitle": "VP of Engineering",
        "businessEmail": "sarah@apexai.io",
        "emailVerified": true,
        "source": "manual",
        "outreachStatus": "uncontacted",
        "createdAt": "2026-10-11T07:00:00.000Z",
        "updatedAt": "2026-10-11T07:00:00.000Z"
      }
    ],
    "recentActivity": [
      {
        "id": "665e4...",
        "prospectId": "665d1...",
        "activityType": "status_change",
        "summary": "Status changed from discovered to qualified",
        "occurredAt": "2026-10-11T07:10:00.000Z",
        "createdAt": "2026-10-11T07:10:00.000Z"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | `id` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | Prospect not found in this workspace |

### curl
```bash
curl http://localhost:4000/api/v1/prospects/665d1... \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## 22. Prospects — Disqualify Prospect

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/:id/disqualify` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:search` (`owner`, `admin`, `member`) |

> Transitions prospect to `disqualified`. Idempotent if already disqualified. A prospect in `do_not_contact` cannot be disqualified directly (must clear DNC first).

### Request Body (`application/json`)
```json
{
  "reason": "Not looking for SDR automation this quarter"
}
```

| Field | Type | Rules |
|---|---|---|
| `reason` | string | optional, 1–300 chars |

### Response `200`
```json
{
  "data": {
    "id": "665d1...",
    "icpId": "665c1...",
    "name": "Apex AI Inc",
    "status": "disqualified",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:20:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Reason exceeds 300 characters |
| 400 | `MALFORMED_REQUEST` | `id` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | Prospect not found in this workspace |
| 409 | `INVALID_STATE` | Cannot disqualify a `do_not_contact` prospect directly |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/665d1.../disqualify \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"reason":"Not looking for SDR automation this quarter"}'
```

---

## 23. Prospects — Mark Do Not Contact

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/:id/do-not-contact` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:mark_dnc` (`owner`, `admin`, `member`) |

> Sets prospect status to `do_not_contact` and automatically cascades outreach status to `do_not_contact` on all related contacts. Logs an audit event to `sales_activities`.

### Request Body (`application/json`)
```json
{
  "reason": "Requested removal from outreach via email reply"
}
```

| Field | Type | Rules |
|---|---|---|
| `reason` | string | optional, 1–300 chars |

### Response `200`
```json
{
  "data": {
    "id": "665d1...",
    "icpId": "665c1...",
    "name": "Apex AI Inc",
    "status": "do_not_contact",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:25:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Reason exceeds 300 characters |
| 400 | `MALFORMED_REQUEST` | `id` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | Prospect not found in this workspace |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/665d1.../do-not-contact \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"reason":"Requested removal from outreach"}'
```

---

## 24. Prospects — Clear Do Not Contact

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/:id/clear-do-not-contact` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:clear_dnc` (`owner`, `admin` only) |

> Clears `do_not_contact` status and transitions prospect back to `qualified`. Requires a mandatory justification reason (minimum 5 characters). General members cannot execute this action.

### Request Body (`application/json`)
```json
{
  "reason": "Executive changed company and new leadership opted back in"
}
```

| Field | Type | Rules |
|---|---|---|
| `reason` | string | **required**, 5–300 chars |

### Response `200`
```json
{
  "data": {
    "id": "665d1...",
    "icpId": "665c1...",
    "name": "Apex AI Inc",
    "status": "qualified",
    "createdAt": "2026-10-11T07:00:00.000Z",
    "updatedAt": "2026-10-11T07:30:00.000Z"
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Reason missing or under 5 characters |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 403 | `FORBIDDEN` | Members cannot clear DNC (requires admin or owner) |
| 404 | `NOT_FOUND` | Prospect not found in this workspace |
| 409 | `INVALID_STATE` | Prospect is not currently marked `do_not_contact` |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/665d1.../clear-do-not-contact \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"reason":"New leadership opted back in for discovery"}'
```

---

## 25. Scoring — Batch Score Prospects

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/prospects/score` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `prospect:score` (`owner`, `admin`, `member`) |

> Deterministically scores 1..50 prospects against an active ICP. If any prospect ID does not belong to the workspace, the entire batch fails (`422 VALIDATION_FAILED`) with zero scores saved. Scores incorporate firmographics, verified contacts, and active buying signals within 45 days.

### Request Body (`application/json`)
```json
{
  "icpId": "665c1...",
  "prospectIds": [
    "665d1..."
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `icpId` | string | 24-character ObjectId of an active ICP |
| `prospectIds` | string[] | array of 1..50 24-character ObjectIds |

### Response `200`
```json
{
  "data": {
    "scored": 1,
    "items": [
      {
        "id": "665e1...",
        "prospectId": "665d1...",
        "icpId": "665c1...",
        "score": 86,
        "category": "hot",
        "coverage": 0.82,
        "breakdown": {
          "firmographics": 40,
          "jobTitles": 26,
          "signals": 20,
          "penalties": 0
        },
        "explanation": "Strong match on industry (Software Development) and employee count (65).",
        "explanationSource": "rule_based",
        "scoringVersion": "deterministic-v1",
        "icpVersion": 1,
        "scoredAt": "2026-10-11T07:00:00.000Z",
        "createdAt": "2026-10-11T07:00:00.000Z"
      }
    ]
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Empty prospect list, invalid IDs, or > 50 prospects |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | ICP not found in this workspace |
| 409 | `INVALID_STATE` | Archived ICPs cannot be used for new scoring |
| 422 | `VALIDATION_FAILED` | One or more prospect IDs do not belong to this workspace |

### curl
```bash
curl -X POST http://localhost:4000/api/v1/prospects/score \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt \
  -d '{"icpId":"665c1...","prospectIds":["665d1..."]}'
```

---

## 26. Scoring — Get Prospect Score & History

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/prospects/:id/scores` |
| **Auth required** | **Yes** — `bc_session` cookie |
| **Tenant header** | **Yes** — `x-startup-id: <startupId>` |
| **Permission** | `workspace:read` (`owner`, `admin`, `member`) |

### Query Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `icpId` | string | *(prospect origin ICP)* | Filter to score for a specific ICP |
| `history` | string | `"false"` | If `"true"`, returns full historical audit trail |
| `page` | integer | `1` | Page number when `history=true` |
| `limit` | integer | `20` | Page size when `history=true` (1..100) |

### Response `200` — Latest Score (`history=false`)
```json
{
  "data": {
    "id": "665e1...",
    "prospectId": "665d1...",
    "icpId": "665c1...",
    "score": 86,
    "category": "hot",
    "coverage": 0.82,
    "breakdown": {
      "firmographics": 40,
      "jobTitles": 26,
      "signals": 20,
      "penalties": 0
    },
    "explanation": "Strong match on industry (Software Development) and employee count (65).",
    "explanationSource": "rule_based",
    "scoringVersion": "deterministic-v1",
    "icpVersion": 1,
    "scoredAt": "2026-10-11T07:00:00.000Z",
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```

### Response `200` — History Trail (`history=true`)
```json
{
  "data": [
    {
      "id": "665e1...",
      "prospectId": "665d1...",
      "icpId": "665c1...",
      "score": 86,
      "category": "hot",
      "coverage": 0.82,
      "breakdown": {
        "firmographics": 40,
        "jobTitles": 26,
        "signals": 20,
        "penalties": 0
      },
      "explanation": "Strong match on industry (Software Development) and employee count (65).",
      "explanationSource": "rule_based",
      "scoringVersion": "deterministic-v1",
      "icpVersion": 1,
      "scoredAt": "2026-10-11T07:00:00.000Z",
      "createdAt": "2026-10-11T07:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### Errors
| Status | Code | Reason |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | `id` or `icpId` is not a 24-character ObjectId |
| 401 | `UNAUTHENTICATED` | Cookie missing or expired |
| 404 | `NOT_FOUND` | Prospect, ICP, or score not found |

### curl
```bash
# Get latest score
curl http://localhost:4000/api/v1/prospects/665d1.../scores \
  -H "x-startup-id: 665a..." \
  -b cookies.txt

# Get historical score audit trail
curl "http://localhost:4000/api/v1/prospects/665d1.../scores?history=true&page=1&limit=10" \
  -H "x-startup-id: 665a..." \
  -b cookies.txt
```

---

## Quick Reference Table

| # | Method | URL | Auth | Tenant Header | Permission | Purpose |
|---|---|---|---|---|---|---|
| 0 | `GET` | `/health` | — | — | — | Server liveness |
| 1 | `POST` | `/api/v1/auth/register` | — | — | — | Create user account |
| 2 | `POST` | `/api/v1/auth/login` | — | — | — | Login, sets session cookie |
| 3 | `GET` | `/api/v1/auth/me` | Cookie | — | — | Current user info + memberships |
| 4 | `POST` | `/api/v1/auth/logout` | — | — | — | Clear session cookie |
| 5 | `GET` | `/api/v1/startups` | Cookie | — | — | List my startups |
| 6 | `POST` | `/api/v1/startups` | Cookie | — | — | Create new startup workspace |
| 7 | `GET` | `/api/v1/startups/current` | Cookie | `x-startup-id` | `workspace:read` | Current startup detail, spend & capabilities |
| 8 | `PATCH` | `/api/v1/startups/current` | Cookie | `x-startup-id` | `workspace:settings` | Update startup name & settings |
| 9 | `GET` | `/api/v1/startups/current/members` | Cookie | `x-startup-id` | `workspace:read` | List workspace members |
| 10 | `POST` | `/api/v1/startups/current/members` | Cookie | `x-startup-id` | `member:invite` | Invite member (`admin` or `member`) |
| 11 | `PATCH` | `/api/v1/startups/current/members/:memberId` | Cookie | `x-startup-id` | `member:role` | Update member role (`owner`/`admin`/`member`) |
| 12 | `DELETE` | `/api/v1/startups/current/members/:memberId` | Cookie | `x-startup-id` | `member:role` | Soft-remove member (`status=removed`) |
| 13 | `POST` | `/api/v1/icps` | Cookie | `x-startup-id` | `icp:write` | Create Ideal Customer Profile |
| 14 | `GET` | `/api/v1/icps` | Cookie | `x-startup-id` | `workspace:read` | List ICPs with pagination |
| 15 | `GET` | `/api/v1/icps/:id` | Cookie | `x-startup-id` | `workspace:read` | Get ICP by ID |
| 16 | `PATCH` | `/api/v1/icps/:id` | Cookie | `x-startup-id` | `icp:write` | Update ICP name / criteria |
| 17 | `POST` | `/api/v1/icps/:id/archive` | Cookie | `x-startup-id` | `icp:write` | Archive ICP (soft-delete) |
| 18 | `POST` | `/api/v1/prospects/search` | Cookie | `x-startup-id` | `prospect:search` | Live discovery search (guarded 503) |
| 19 | `GET` | `/api/v1/prospects` | Cookie | `x-startup-id` | `workspace:read` | List prospects with filters & pagination |
| 20 | `POST` | `/api/v1/prospects/select` | Cookie | `x-startup-id` | `prospect:search` | Batch select / qualify prospects |
| 21 | `GET` | `/api/v1/prospects/:id` | Cookie | `x-startup-id` | `workspace:read` | Get prospect detail with scores & signals |
| 22 | `POST` | `/api/v1/prospects/:id/disqualify` | Cookie | `x-startup-id` | `prospect:search` | Disqualify prospect |
| 23 | `POST` | `/api/v1/prospects/:id/do-not-contact` | Cookie | `x-startup-id` | `prospect:mark_dnc` | Mark prospect as do-not-contact |
| 24 | `POST` | `/api/v1/prospects/:id/clear-do-not-contact` | Cookie | `x-startup-id` | `prospect:clear_dnc` | Clear do-not-contact (admin/owner) |
| 25 | `POST` | `/api/v1/prospects/score` | Cookie | `x-startup-id` | `prospect:score` | Batch deterministic prospect scoring |
| 26 | `GET` | `/api/v1/prospects/:id/scores` | Cookie | `x-startup-id` | `workspace:read` | Get latest score or history audit trail |

---

## Testing Flow (in order)

```bash
# 1. Health check
curl http://localhost:4000/health

# 2. Register primary user
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -d '{"name":"Alice Founder","email":"alice@example.com","password":"strongpassword1"}'

# 3. Login (saves session cookie)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -c cookies.txt \
  -d '{"email":"alice@example.com","password":"strongpassword1"}'

# 4. View session info
curl http://localhost:4000/api/v1/auth/me -b cookies.txt

# 5. Create a startup workspace
curl -X POST http://localhost:4000/api/v1/startups \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"name":"Acme AI"}'
# (Take "id" from response, e.g. STARTUP_ID=665a...)

# 6. Get current startup detail & spend cap
curl http://localhost:4000/api/v1/startups/current \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 7. Update workspace settings
curl -X PATCH http://localhost:4000/api/v1/startups/current \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"name":"Acme AI Corp","settings":{"calendarLink":"https://cal.com/acme/demo","senderName":"Alice Founder"}}'

# 8. List workspace members
curl http://localhost:4000/api/v1/startups/current/members \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 9. Create an Ideal Customer Profile (ICP)
curl -X POST http://localhost:4000/api/v1/icps \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"name":"Series A AI Startups","criteria":{"industries":["Software Development"],"targetJobTitles":["VP Engineering"]}}'
# (Take "id" from response, e.g. ICP_ID=665c...)

# 10. List ICPs
curl "http://localhost:4000/api/v1/icps?isActive=true&page=1&limit=10" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 11. List prospects for this workspace
curl "http://localhost:4000/api/v1/prospects?page=1&limit=20" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt
# (Take "id" from response, e.g. PROSPECT_ID=665d...)

# 12. Score prospects against the ICP
curl -X POST http://localhost:4000/api/v1/prospects/score \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"icpId":"<ICP_ID>","prospectIds":["<PROSPECT_ID>"]}'

# 13. Get prospect latest score & history
curl http://localhost:4000/api/v1/prospects/<PROSPECT_ID>/scores \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

curl "http://localhost:4000/api/v1/prospects/<PROSPECT_ID>/scores?history=true&page=1&limit=10" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 14. Batch qualify the prospect
curl -X POST http://localhost:4000/api/v1/prospects/select \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"prospectIds":["<PROSPECT_ID>"]}'

# 15. View full prospect detail (firmographics, scores, contacts, signals)
curl http://localhost:4000/api/v1/prospects/<PROSPECT_ID> \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 16. Mark prospect as Do Not Contact (DNC)
curl -X POST http://localhost:4000/api/v1/prospects/<PROSPECT_ID>/do-not-contact \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"reason":"Requested opt out"}'

# 17. Clear Do Not Contact (admin / owner)
curl -X POST http://localhost:4000/api/v1/prospects/<PROSPECT_ID>/clear-do-not-contact \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"reason":"Leadership re-engaged for Q4 demo"}'

# 18. Disqualify prospect
curl -X POST http://localhost:4000/api/v1/prospects/<PROSPECT_ID>/disqualify \
  -H "Content-Type: application/json" \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt \
  -d '{"reason":"Not in target market"}'

# 19. Archive ICP
curl -X POST http://localhost:4000/api/v1/icps/<ICP_ID>/archive \
  -H "x-requested-with: XMLHttpRequest" \
  -H "x-startup-id: <STARTUP_ID>" \
  -b cookies.txt

# 20. Logout
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "x-requested-with: XMLHttpRequest" \
  -b cookies.txt -c cookies.txt
```
