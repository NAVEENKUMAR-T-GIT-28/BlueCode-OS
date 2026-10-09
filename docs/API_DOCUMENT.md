# AI Founder OS: Sales Copilot — API Documentation

> **Base URL:** `/api/v1`  
> **Server Host:** `http://localhost:8000` (Local) / `https://www.bluecode-os.com` (Production)  
> **Specification Version:** `v1.0.0 (Sprint 2)`  
> **Authentication:** HTTP-only Session Cookie (`session` containing JWT)  
> **Data Isolation:** PostgreSQL Row-Level Security (RLS) via Tenant Session Context  

---

## 1. Overview & Architecture

The **AI Founder OS API** is a high-performance RESTful API built with **FastAPI**, **SQLAlchemy 2.x**, and **PostgreSQL 16**. It powers the **AI Sales Copilot** SaaS platform, enabling early-stage startups to automate B2B outbound sales pipelines.

### Key Architectural Tenets:
1. **Multi-Tenant Row-Level Security (RLS):** Every authenticated request runs inside a database transaction scoped with `SET LOCAL app.current_startup_id = '<tenant_uuid>'`. No tenant can read or mutate another tenant's data even in the event of application logic vulnerabilities.
2. **Unified Error Envelope:** All error responses follow a consistent, machine-readable JSON structure.
3. **Hard Budget Gate:** API operations involving external AI providers or contact enrichment check and reserve budget before calling external services.
4. **Asynchronous Job Engine:** Long-running workflows (prospect discovery, AI lead scoring, sequence generation) execute through a background worker via the `jobs` table with polling support.

---

## 2. Authentication & Security

### 2.1 Session Cookie Authentication
- Authentication is handled via a **JWT** stored in a secure, `httpOnly` cookie named **`session`**.
- The cookie attributes:
  - `HttpOnly`: `true` (inaccessible to JavaScript)
  - `Secure`: `true` in production, `false` in local development
  - `SameSite`: `Lax`
  - `Path`: `/`
  - `Max-Age`: `720` minutes (12 hours by default)

### 2.2 JWT Claims
```json
{
  "sub": "<user_uuid>",
  "startup_id": "<tenant_startup_uuid>",
  "role": "owner",
  "exp": 1728475200
}
```

### 2.3 Rate Limiting & Brute-Force Throttling
- **Login Throttling:** 5 failed attempts per 15 minutes per email address and per client IP. Exceeding this limit returns HTTP `429 Too Many Requests`.
- **Timing Attack Mitigation:** Authentication verifies passwords using `argon2` against dummy hashes when users are not found.

---

## 3. Standard Response & Error Format

### 3.1 Success Responses
Successful requests return standard JSON with HTTP status `200 OK`, `201 Created`, or `204 No Content`.

### 3.2 Error Envelope
All application errors follow this schema:

```json
{
  "code": "error_code_string",
  "message": "Human-readable explanation of what went wrong",
  "details": {}
}
```

### 3.3 HTTP Status Codes
| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| **`400`** | `bad_request` | Malformed request or illegal parameters |
| **`401`** | `unauthorized`, `invalid_credentials` | Missing, expired, or invalid session |
| **`403`** | `forbidden`, `account_suspended` | Action not allowed for current tenant or status |
| **`404`** | `not_found` | Resource does not exist (or belongs to another tenant) |
| **`409`** | `conflict`, `email_taken`, `icp_limit_reached`, `not_retryable` | State conflict or uniqueness constraint violation |
| **`422`** | `validation_error`, `icp_incomplete` | Payload failed Pydantic schema validation |
| **`429`** | `too_many_requests` | Rate limit or throttle exceeded |
| **`500`** | `internal_error` | Unexpected server failure (includes `request_id`) |
| **`503`** | `service_unavailable`, `llm_unavailable`, `encryption_not_configured` | Upstream service or provider unavailable |

---

## 4. Endpoints Reference

### 4.1 Health Check

#### `GET /healthz`
Service liveness and database connectivity check. Does not require authentication.

- **Request:** None
- **Response `200 OK`:**
```json
{
  "status": "ok"
}
```
- **Response `503 Service Unavailable`:**
```json
{
  "status": "unavailable"
}
```

---

### 4.2 Authentication & User Profile

#### `POST /api/v1/auth/signup`
Creates a new startup tenant account, primary owner user, and initializes usage quota.

- **Status Code:** `201 Created`
- **Sets Cookie:** `session`
- **Request Body:**
```json
{
  "startup_name": "Bluecode Technologies",
  "email": "founder@bluecode.io",
  "password": "StrongPassword123!"
}
```
| Field | Type | Rules | Description |
|-------|------|-------|-------------|
| `startup_name` | string | 1-120 chars | Name of the startup/organization |
| `email` | string (email) | Valid email format | User's work email address |
| `password` | string | 8-128 chars | Account password (hashed via Argon2) |

- **Response `201 Created`:**
```json
{
  "user_id": "a3b118b6-3782-491b-85d7-ecf9250b7318",
  "startup_id": "d74c05e1-70bf-42a9-bfa2-3c833d71249b",
  "email": "founder@bluecode.io",
  "trial_ends_at": "2026-10-24T02:00:00+00:00"
}
```

- **Error Responses:**
  - `409 Conflict` (`code: "email_taken"`): An account with this email already exists.
  - `422 Unprocessable Entity`: Validation failure (short password, invalid email).

---

#### `POST /api/v1/auth/login`
Authenticates existing user credentials, validates account status, and issues the `session` cookie.

- **Status Code:** `200 OK`
- **Sets Cookie:** `session`
- **Request Body:**
```json
{
  "email": "founder@bluecode.io",
  "password": "StrongPassword123!"
}
```

- **Response `200 OK`:**
```json
{
  "user_id": "a3b118b6-3782-491b-85d7-ecf9250b7318",
  "startup_id": "d74c05e1-70bf-42a9-bfa2-3c833d71249b",
  "email": "founder@bluecode.io"
}
```

- **Error Responses:**
  - `401 Unauthorized` (`code: "invalid_credentials"`): Invalid email or password.
  - `403 Forbidden` (`code: "account_suspended"`): Account has been suspended.
  - `429 Too Many Requests`: Exceeded 5 failed login attempts in 15 minutes.

---

#### `POST /api/v1/auth/logout`
Terminates the user session by clearing the `session` cookie.

- **Status Code:** `204 No Content`
- **Clears Cookie:** `session`

---

#### `GET /api/v1/me`
Retrieves the profile of the currently logged-in user and tenant subscription details.

- **Requires Auth:** Yes
- **Response `200 OK`:**
```json
{
  "user_id": "a3b118b6-3782-491b-85d7-ecf9250b7318",
  "email": "founder@bluecode.io",
  "role": "owner",
  "startup_id": "d74c05e1-70bf-42a9-bfa2-3c833d71249b",
  "startup_name": "Bluecode Technologies",
  "status": "trial",
  "plan": "pilot",
  "trial_ends_at": "2026-10-24T02:00:00+00:00"
}
```

---

### 4.3 Ideal Customer Profile (ICP) Builder

#### `POST /api/v1/icps`
Takes a natural-language product description and invokes the LLM layer to extract structured B2B targeting criteria mapped to Apollo directory filters.

- **Requires Auth:** Yes
- **Status Code:** `201 Created`
- **Request Body:**
```json
{
  "product_description": "We build an automated HR payroll and compliance SaaS platform for mid-sized IT and software services companies with 50 to 500 employees located in India. Target buyers are Chief Human Resources Officers, HR Heads, and Founders."
}
```

- **Response `201 Created`:**
```json
{
  "id": "e2a09c21-2e65-4d7a-a43c-687e8346df22",
  "product_description": "We build an automated HR payroll...",
  "criteria": {
    "industries": ["Information Technology & Services", "Computer Software"],
    "headcount_min": 50,
    "headcount_max": 500,
    "geographies": ["India"],
    "languages": ["English"],
    "job_titles": ["Chief Human Resources Officer", "VP Human Resources", "Head of HR", "Founder"],
    "exclusions": ["Staffing & Recruiting"]
  },
  "confirmed": false,
  "created_at": "2026-10-09T07:45:00+00:00",
  "parse_status": "ai",
  "notes": []
}
```

- **Fallback Behavior:** If the LLM provider is down or budget is exhausted, `parse_status` will be `"manual"` with empty criteria and an actionable note explaining manual completion.
- **Error Responses:**
  - `409 Conflict` (`code: "icp_limit_reached"`): Pilot plan allows a maximum of 1 ICP per startup.

---

#### `GET /api/v1/icps`
Lists all ICPs associated with the current startup.

- **Requires Auth:** Yes
- **Response `200 OK`:**
```json
[
  {
    "id": "e2a09c21-2e65-4d7a-a43c-687e8346df22",
    "product_description": "We build an automated HR payroll...",
    "criteria": { ... },
    "confirmed": true,
    "created_at": "2026-10-09T07:45:00+00:00",
    "parse_status": null,
    "notes": []
  }
]
```

---

#### `GET /api/v1/icps/{icp_id}`
Retrieves a specific ICP by ID.

- **Requires Auth:** Yes
- **Path Parameters:** `icp_id` (UUID)
- **Response `200 OK`:** (See `ICPOut` schema above)
- **Error Responses:**
  - `404 Not Found`: ICP does not exist or belongs to another tenant.

---

#### `PUT /api/v1/icps/{icp_id}`
Updates criteria fields or sets `confirm = true`.

- **Requires Auth:** Yes
- **Path Parameters:** `icp_id` (UUID)
- **Request Body:**
```json
{
  "product_description": "Updated product description...",
  "criteria": {
    "industries": ["Information Technology & Services"],
    "headcount_min": 50,
    "headcount_max": 500,
    "geographies": ["India"],
    "languages": ["English"],
    "job_titles": ["Chief Human Resources Officer", "Head of HR"],
    "exclusions": ["Staffing Agencies"]
  },
  "confirm": true
}
```

- **Validation Rules for Confirmation:**
  - When `confirm: true` is passed, `industries`, `geographies`, and `job_titles` must each have at least one valid item.
- **Error Responses:**
  - `422 Unprocessable Entity` (`code: "icp_incomplete"`): Missing required criteria to confirm.

---

#### `POST /api/v1/icps/{icp_id}/reparse`
Re-runs AI parsing against a modified product description without losing old data if the AI provider fails. Resets `confirmed` to `false`.

- **Requires Auth:** Yes
- **Path Parameters:** `icp_id` (UUID)
- **Request Body:**
```json
{
  "product_description": "We are expanding our product to cover B2B logistics firms with 100-1000 employees in Southeast Asia."
}
```
- **Response `200 OK`:** Updated ICP with new parsed criteria.

---

### 4.4 Background Jobs Engine

#### `GET /api/v1/jobs`
Lists background operations (prospect discovery, scoring, sequences, inbox sync) for the current tenant.

- **Requires Auth:** Yes
- **Query Parameters:**
  - `status` (optional, string): Filter by `queued`, `running`, `succeeded`, `partial`, `failed`, `paused_budget`
  - `limit` (optional, int, default: `50`, min: `1`, max: `200`)
- **Response `200 OK`:**
```json
[
  {
    "id": "b18b3cb4-54c3-4d4b-9721-654871891b29",
    "type": "discover",
    "status": "running",
    "total": 50,
    "done": 28,
    "failed": 0,
    "error": null,
    "attempts": 1,
    "max_attempts": 3,
    "run_after": "2026-10-09T07:40:00+00:00",
    "created_at": "2026-10-09T07:40:00+00:00",
    "finished_at": null
  }
]
```

---

#### `GET /api/v1/jobs/{job_id}`
Fetches the current progress of a specific job (used for real-time progress bars).

- **Requires Auth:** Yes
- **Path Parameters:** `job_id` (UUID)
- **Response `200 OK`:** (See `JobOut` schema above)
- **Error Responses:**
  - `404 Not Found`: Job does not exist or belongs to another tenant.

---

#### `POST /api/v1/jobs/{job_id}/retry`
Re-queues a failed, partial, or budget-paused job.

- **Requires Auth:** Yes
- **Path Parameters:** `job_id` (UUID)
- **Response `200 OK`:** Job entity with status reset to `queued` and `attempts` reset to `0`.
- **Error Responses:**
  - `409 Conflict` (`code: "not_retryable"`): Job is currently running or already succeeded.

---

### 4.5 Usage Tracker & Budget Gate

#### `GET /api/v1/usage`
Returns the startup's current trial balance, spend consumption, and activity counters.

- **Requires Auth:** Yes
- **Response `200 OK`:**
```json
{
  "cap_minor": 100000,
  "reserved_minor": 0,
  "spent_minor": 14250,
  "remaining_minor": 85750,
  "prospects_used": 35,
  "dm_lookups_used": 30,
  "messages_generated": 25,
  "emails_sent": 12,
  "apollo_dms_generated": 8,
  "status": "trial",
  "trial_ends_at": "2026-10-24T02:00:00+00:00",
  "trial_days_left": 15
}
```
*Note: Monetary values are stored in minor currency units (paise, where 100,000 minor = ₹1,000.00).*

---

### 4.6 Tenant Settings & Mailbox Integrations

#### `GET /api/v1/settings`
Returns company profile details, daily send volume caps, booking links, and mailbox configuration status. Passwords are write-only and are never exposed.

- **Requires Auth:** Yes
- **Response `200 OK`:**
```json
{
  "company_name": "Bluecode Technologies",
  "plan": "pilot",
  "status": "trial",
  "trial_ends_at": "2026-10-24T02:00:00+00:00",
  "sender_name": "Naveen",
  "sender_address": "Bangalore, India",
  "booking_link": "https://calendly.com/bluecode/demo",
  "daily_send_cap": 30,
  "smtp": {
    "configured": true,
    "readable": true,
    "host": "smtp.gmail.com",
    "port": 465,
    "username": "outreach@bluecode.io",
    "security": "ssl"
  },
  "imap": {
    "configured": true,
    "readable": true,
    "host": "imap.gmail.com",
    "port": 993,
    "username": "outreach@bluecode.io",
    "security": "ssl"
  }
}
```

---

#### `PUT /api/v1/settings`
Updates tenant company name, sender headers, booking link, and configures encrypted SMTP/IMAP credentials.

- **Requires Auth:** Yes
- **Request Body:**
```json
{
  "company_name": "Bluecode Technologies",
  "sender_name": "Naveen Kumar",
  "sender_address": "Indiranagar, Bangalore, KA, India",
  "booking_link": "https://calendly.com/bluecode/demo",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 465,
    "username": "outreach@bluecode.io",
    "password": "your-app-password",
    "security": "ssl"
  },
  "imap": {
    "host": "imap.gmail.com",
    "port": 993,
    "username": "outreach@bluecode.io",
    "password": "your-app-password",
    "security": "ssl"
  }
}
```

- **Security Note:** Mailbox passwords are encrypted via AES-GCM using `APP_ENCRYPTION_KEY` before saving to the database.
- **Error Responses:**
  - `422 Unprocessable Entity`: Invalid booking link format (must be full `https://` URL) or malformed host name.
  - `503 Service Unavailable` (`code: "encryption_not_configured"`): `APP_ENCRYPTION_KEY` environment variable is missing on the server.

---

## 5. Client Integration Code Examples

### 5.1 TypeScript / Fetch (Web Client)
```typescript
// Example: Creating an ICP with session cookies
async function createICP(description: string) {
  const response = await fetch('/api/v1/icps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Ensures HTTP-only session cookie is attached
    body: JSON.stringify({ product_description: description }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`[${errorData.code}] ${errorData.message}`);
  }

  return await response.json();
}
```

### 5.2 Python (Async HTTPX Client)
```python
import httpx

async def get_usage_metrics(base_url: str, session_cookie: str):
    async with httpx.AsyncClient(base_url=base_url, cookies={"session": session_cookie}) as client:
        response = await client.get("/api/v1/usage")
        response.raise_for_status()
        return response.json()
```

### 5.3 cURL (Command Line)
```bash
# 1. Sign in and store cookie in jar
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "founder@bluecode.io", "password": "StrongPassword123!"}'

# 2. Authenticated request using cookie jar
curl -X GET http://localhost:8000/api/v1/me \
  -b cookies.txt

# 3. Check current usage & budget
curl -X GET http://localhost:8000/api/v1/usage \
  -b cookies.txt
```
