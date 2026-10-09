# AI Founder OS — Sales Copilot API Documentation
**Version:** 1.0 (MVP)  
**Base URL:** `http://localhost:3000/api/v1`  
**Target Domain:** `www.bluecode-os.com`

---

## 1. Overview & Multi-Tenant Architecture

AI Founder OS is a multi-tenant SaaS platform empowering startups with an autonomous AI-powered sales copilot.

### Authentication & Tenant Isolation
All protected API endpoints require a **JWT Bearer Token** in the HTTP Authorization header:
```http
Authorization: Bearer <your_jwt_token>
```
* **Tenant Isolation**: Each request context validates `startup_id` (or `tenant_id`) from the JWT payload. Database queries filter strictly by `startup_id` to ensure zero cross-tenant data leaks.
* **Rate Guardrails**: Requests are checked against the startup's `Usage_Tracker` spend limit (e.g., hard cap of ₹1,000 / month for trial/starter tiers) before invoking LLM or Apollo APIs.

---

## 2. Standard Response & Error Format

### Success Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED | RATE_LIMIT_EXCEEDED | INVALID_INPUT | NOT_FOUND | INTERNAL_ERROR",
    "message": "Detailed error description"
  }
}
```

---

## 3. Endpoints Specification

### 3.1 Authentication & Workspace (`/auth`)

#### `POST /auth/register`
Registers a new startup tenant account and primary admin user.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "company_name": "ABC Technologies",
    "email": "founder@abctech.com",
    "password": "SecurePassword123!",
    "plan": "free_trial"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "tenant_id": "tenant_abc123",
      "user_id": "usr_99812",
      "token": "eyJhbGciOiJIUzI1NiIsInR5..."
    }
  }
  ```

#### `POST /auth/login`
Authenticates a user and returns a JWT token containing `startup_id` and role context.
* **Request Body:**
  ```json
  {
    "email": "founder@abctech.com",
    "password": "SecurePassword123!"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5...",
      "user": {
        "user_id": "usr_99812",
        "email": "founder@abctech.com",
        "tenant_id": "tenant_abc123",
        "role": "admin"
      }
    }
  }
  ```

#### `GET /auth/me`
Retrieves current user and workspace tenant profile.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user_id": "usr_99812",
      "company_name": "ABC Technologies",
      "tenant_id": "tenant_abc123",
      "plan": "free_trial",
      "status": "active"
    }
  }
  ```

---

### 3.2 Module 1: ICP Builder (`/icp`)

#### `POST /icp`
Configures or updates target Ideal Customer Profile parameters.
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "industry": "Indian B2B Software",
    "headcount_min": 50,
    "headcount_max": 500,
    "geographies": ["India", "Southeast Asia"],
    "target_roles": ["Founder", "CEO", "HR Head", "CTO"],
    "exclusions": ["Consulting", "Agency"]
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "icp_id": "icp_7712",
      "startup_id": "tenant_abc123",
      "criteria_json": { ... },
      "updated_at": "2026-10-09T11:25:00Z"
    }
  }
  ```

#### `GET /icp`
Fetches current active ICP configuration.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "icp_id": "icp_7712",
      "industry": "Indian B2B Software",
      "headcount": "50-500",
      "target_roles": ["Founder", "CEO", "HR Head", "CTO"]
    }
  }
  ```

---

### 3.3 Module 2: Prospect & DM Finder (`/prospects`)

#### `POST /prospects/search`
Queries external databases (e.g. Apollo.io API) matching configured ICP parameters.
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "limit": 25,
    "enrich_decision_makers": true
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "prospects_found": 25,
      "items": [
        {
          "prospect_id": "prsp_101",
          "company_name": "Nexus Software Solutions",
          "industry": "B2B SaaS",
          "headcount": 120,
          "geography": "Bengaluru, India",
          "decision_makers": [
            {
              "dm_id": "dm_501",
              "full_name": "Rohan Sharma",
              "title": "HR Head",
              "email": "rohan@nexussoft.com",
              "linkedin_url": "https://linkedin.com/in/rohansharma"
            }
          ]
        }
      ]
    }
  }
  ```

#### `GET /prospects`
Lists all saved prospects for current startup workspace.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "total": 25,
      "prospects": [ ... ]
    }
  }
  ```

---

### 3.4 Module 3: AI Lead Scoring Engine (`/leads`)

#### `POST /leads/score`
Runs AI scoring algorithms evaluating prospect match relevance (0–100 score + text rationale).
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "prospect_ids": ["prsp_101", "prsp_102"]
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "lead_id": "lead_301",
        "prospect_id": "prsp_101",
        "company_name": "Nexus Software Solutions",
        "score": 92,
        "category": "Hot",
        "rationale": "Perfect fit: 120 headcount B2B SaaS in Bengaluru with active HR hiring drive."
      }
    ]
  }
  ```

#### `GET /leads`
Retrieves ranked leads categorized by score priority (`Hot`: 90-100, `High`: 70-89, `Medium`: 50-69).
* **Headers:** `Authorization: Bearer <token>`
* **Query Params:** `?category=Hot`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "hot_leads_count": 12,
      "leads": [ ... ]
    }
  }
  ```

---

### 3.5 Module 4: Personalized Outreach Generator (`/outreach`)

#### `POST /outreach/generate`
Generates LLM-customized cold email subject line, body, and multi-touch Apollo DM sequences.
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "lead_id": "lead_301",
    "dm_id": "dm_501"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "msg_id": "msg_801",
      "cold_email": {
        "subject": "Automating HR workflows at Nexus Software",
        "body": "Hi Rohan,\n\nI noticed Nexus Software is rapidly scaling its B2B team in Bengaluru..."
      },
      "apollo_dm": {
        "message": "Hi Rohan, loved your recent post on scaling engineering teams..."
      },
      "follow_up_1": "Hi Rohan, wanted to quickly bump this...",
      "follow_up_2": "Hi Rohan, final follow up..."
    }
  }
  ```

#### `POST /outreach/send`
Dispatches email via SendGrid/SMTP or posts message via Apollo API.
* **Request Body:**
  ```json
  {
    "msg_id": "msg_801",
    "channel": "email"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "DISPATCHED",
      "dispatched_at": "2026-10-09T11:25:32Z"
    }
  }
  ```

---

### 3.6 Module 5: Follow-up Assistant (`/followups`)

#### `GET /followups/pending`
Lists prospects requiring follow-up action due to inactivity.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "pending_count": 18,
      "followups": [
        {
          "prospect_id": "prsp_101",
          "dm_name": "Rohan Sharma",
          "last_contacted_days_ago": 3,
          "recommended_action": "Send Follow-up #1 (Bump)"
        }
      ]
    }
  }
  ```

---

### 3.7 Module 6: Auto-Scheduling Integration (`/meetings`)

#### `POST /meetings/schedule`
Appends startup calendar links (Calendly/Custom) upon detecting positive reply intent.
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "dm_id": "dm_501",
    "booking_link": "https://calendly.com/founder-abctech/30min",
    "reply_text": "Sounds interesting, let's connect next Tuesday."
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "intent_detected": "POSITIVE",
      "meeting_status": "INVITE_SENT",
      "calendar_link_appended": "https://calendly.com/founder-abctech/30min"
    }
  }
  ```

---

### 3.8 Module 7: Centralized Sales Dashboard (`/dashboard` & `/usage`)

#### `GET /dashboard/metrics`
Summarizes daily actionable sales metrics for the startup dashboard.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "prospects_found": 25,
      "hot_leads": 12,
      "messages_ready": 10,
      "followups_pending": 8,
      "meetings_booked": 3
    }
  }
  ```

#### `GET /usage`
Fetches API spend tracking and cost guardrails against tier limit caps.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "startup_id": "tenant_abc123",
      "plan": "free_trial",
      "api_spend_inr": 240.50,
      "spend_cap_inr": 1000.00,
      "remaining_spend_inr": 759.50
    }
  }
  ```

---

### 3.9 System Health Check (`/health`)

#### `GET /health`
Public health status for uptime monitoring.
* **Response (200 OK):**
  ```json
  {
    "status": "UP",
    "timestamp": "2026-10-09T11:25:32Z",
    "version": "1.0.0"
  }
  ```
