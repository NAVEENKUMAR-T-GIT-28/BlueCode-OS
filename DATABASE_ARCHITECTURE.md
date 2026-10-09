# AI Founder OS --- Database Architecture

**Document:** `DATABASE_ARCHITECTURE.md`\
**Product:** AI Founder OS --- AI Sales Copilot\
**Database:** MongoDB\
**ODM:** Mongoose\
**Architecture:** Multi-tenant MERN SaaS\
**External sales-data provider for MVP:** Apollo.io only\
**Status:** MVP schema baseline

------------------------------------------------------------------------

## 1. Purpose and scope

This document defines the MongoDB collections, document formats,
constraints, indexes, and relationships for the AI Sales Copilot MVP.

The product flow is:

1.  A founder creates a startup workspace and defines an Ideal Customer
    Profile (ICP).
2.  The founder connects their authorized Apollo account.
3.  The system discovers companies and decision-makers through Apollo.
4.  The system scores prospects against the ICP and records only
    evidence-supported buying signals.
5.  The AI drafts outreach messages.
6.  A founder or authorized member approves messages before outbound
    execution.
7.  Apollo sequence/activity data available to the connected account is
    synchronized.
8.  The product records sales activity and generates next-best-action
    recommendations.
9.  Usage is tracked to enforce operational limits.

Apollo is the only external sales-data provider in this MVP. Do not
assume that Apollo exposes every proposed signal or activity type: store
only fields and events actually available through the connected
account's permitted API access.

### 1.1 Conventions

-   `ObjectId`: MongoDB BSON ObjectId.
-   `Date`: BSON date stored in UTC.
-   `string[]`: array of strings.
-   `ObjectId[]`: array of MongoDB ObjectIds.
-   `object`: structured object whose allowed keys should be explicitly
    validated where practical.
-   `?`: optional field.
-   `ref`: logical Mongoose reference; it does not automatically enforce
    referential integrity or tenant ownership.
-   All tenant-owned documents must include `startupId`.
-   Use Mongoose `timestamps: true` for mutable collections unless
    otherwise noted.
-   Fields shown below are the application data contract. Mongoose
    schemas should explicitly define types, enums, defaults, validation,
    and indexes.

------------------------------------------------------------------------

## 2. Collection inventory

  --------------------------------------------------------------------------------
                     \# Collection            Responsibility      Tenant-owned
  --------------------- --------------------- ------------------- ----------------
                      1 `users`               User identity and   No
                                              authentication      

                      2 `startups`            Tenant/workspace    Root tenant
                                              and startup profile 

                      3 `startupMembers`      Membership and      Yes
                                              workspace roles     

                      4 `integrations`        Apollo OAuth        Yes
                                              connection and      
                                              status              

                      5 `icps`                Ideal Customer      Yes
                                              Profile definitions 

                      6 `prospects`           Apollo-discovered   Yes
                                              companies           

                      7 `decisionMakers`      Contacts belonging  Yes
                                              to prospects        

                      8 `leadScores`          Versioned prospect  Yes
                                              fit scores          

                      9 `buyingSignals`       Evidence-backed     Yes
                                              signals derived     
                                              from Apollo data    

                     10 `outreachCampaigns`   Product-side        Yes
                                              campaign            
                                              configuration and   
                                              Apollo sequence     
                                              reference           

                     11 `outreachMessages`    Drafts, approval    Yes
                                              state and outbound  
                                              synchronization     
                                              status              

                     12 `salesActivities`     Sales event         Yes
                                              timeline            

                     13 `nextBestActions`     AI-recommended next Yes
                                              actions             

                     14 `usageRecords`        Apollo and LLM      Yes
                                              usage accounting    
  --------------------------------------------------------------------------------

A separate `leads` collection is not required for the MVP. `prospects`
plus versioned `leadScores` cover the initial qualification workflow. A
separate `replies` collection is also not required initially;
reply/activity events belong in `salesActivities`, with recommendations
in `nextBestActions`.

------------------------------------------------------------------------

## 3. Shared rules and constraints

### 3.1 Tenant isolation

Every tenant-owned collection must have a required `startupId: ObjectId`
referencing `startups`.

For every request: 1. Authenticate the user. 2. Resolve the active
startup from trusted membership/session context. 3. Confirm an active
`startupMembers` record grants access. 4. Add `startupId` to every
tenant-owned query. 5. Validate that every referenced record belongs to
the same startup before reading or mutating it.

**Required pattern:**

``` js
// Correct: scope the query to the authenticated tenant.
const prospect = await Prospect.findOne({
  _id: prospectId,
  startupId: req.startupId
});

// Incorrect: tenant-owned records must not be queried by _id alone.
const prospect = await Prospect.findById(prospectId);
```

Mongoose `ref` fields do not enforce foreign keys. Tenant ownership and
cross-document relationships must be validated in service logic and
covered by tests.

### 3.2 General validation

-   Reject invalid ObjectIds before querying.
-   Trim required strings and enforce sensible maximum lengths.
-   Normalize user email addresses to lowercase before saving.
-   Validate enum values and numeric ranges.
-   Never trust `startupId`, role, or approval status supplied by the
    client without server-side authorization.
-   Do not store plaintext passwords or expose integration tokens.
-   Avoid storing complete raw Apollo responses unless a specific use
    case requires them; persist only the fields needed by the product.
-   Use UTC dates and server-generated timestamps.
-   Use pagination for list endpoints.
-   Use soft/status-based lifecycle changes where historical sales
    records must remain auditable.

### 3.3 Recommended common index strategy

Create indexes explicitly in migrations or controlled application
startup. Do not depend on production automatic index creation.

For partial unique indexes, only apply uniqueness when the external ID
exists and is a non-empty string. Verify the exact index syntax against
the installed MongoDB/Mongoose versions.

------------------------------------------------------------------------

## 4. Collection schemas

## 4.1 `users`

**Purpose:** Authentication identity, independent of any one startup
workspace.

``` ts
{
  _id: ObjectId,
  name: string,
  email: string,                 // normalized lowercase
  passwordHash: string,          // bcrypt hash only
  status: "active" | "pending_verification" | "disabled",
  emailVerifiedAt?: Date,
  lastLoginAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `name`: required, trimmed, bounded length. - `email`:
required, normalized lowercase, valid email format. - `passwordHash`:
required for password-based authentication; never return it in API
responses. - `status`: required enum; default `pending_verification` or
the state required by the signup flow. - Never store plaintext
passwords, raw password-reset tokens, or authentication secrets.

**Indexes** - Unique `{ email: 1 }`. - Optional `{ status: 1 }` if
administrative status queries need it.

------------------------------------------------------------------------

## 4.2 `startups`

**Purpose:** Tenant/workspace, business context, and plan/status
metadata.

``` ts
{
  _id: ObjectId,
  name: string,
  website?: string,
  description?: string,
  industry?: string,
  productDescription?: string,
  targetMarket?: string,
  salesObjective?: string,
  ownerUserId: ObjectId,          // ref: users
  plan: "trial" | "starter" | "growth" | "pro",
  status: "active" | "suspended" | "closed",
  settings: {
    timezone: string,
    defaultSenderName?: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `name`, `ownerUserId`, `plan`, and `status` are
required. - `ownerUserId` must reference an existing user. -
`settings.timezone` should be a valid IANA timezone identifier. - Plan
quotas and spend caps must be enforced by backend policy/configuration,
not inferred from this document alone.

**Indexes** - `{ ownerUserId: 1 }`. - `{ status: 1 }`.

------------------------------------------------------------------------

## 4.3 `startupMembers`

**Purpose:** Many-to-many relationship between users and startup
workspaces.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  userId: ObjectId,               // ref: users
  role: "owner" | "admin" | "member",
  status: "invited" | "active" | "removed",
  invitedBy?: ObjectId,           // ref: users
  joinedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `userId`, `role`, and `status` are
required. - A user can have only one membership record per startup;
update its status rather than creating duplicates. - Authorization must
require `status: "active"`. - Only authorized roles may invite members,
alter roles, or manage integrations. - The startup owner must have an
active membership record or the application must consistently enforce
ownership through a documented alternative.

**Indexes** - Unique `{ startupId: 1, userId: 1 }`. -
`{ userId: 1, status: 1 }`.

------------------------------------------------------------------------

## 4.4 `integrations`

**Purpose:** Store the Apollo connection metadata and securely stored
OAuth credentials for a startup.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  provider: "apollo",
  status: "connected" | "disconnected" | "error",
  externalAccountId?: string,
  accessTokenEncrypted?: string,
  refreshTokenEncrypted?: string,
  tokenExpiresAt?: Date,
  grantedScopes: string[],
  connectedBy: ObjectId,          // ref: users
  lastSyncedAt?: Date,
  lastError?: {
    code?: string,
    message?: string,
    occurredAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `provider`, `status`, `grantedScopes`,
and `connectedBy` are required. - MVP `provider` enum is only
`"apollo"`. - Token values must be encrypted before persistence and
decrypted only by backend integration code. - Tokens must never be sent
to React clients, logged, or included in error messages. - Request only
required scopes. Implement disconnect/revocation and token refresh only
according to the supported Apollo OAuth lifecycle. - `lastError.message`
must be sanitized; do not put credentials or full sensitive request
headers into it.

**Indexes** - Unique `{ startupId: 1, provider: 1 }`. - `{ status: 1 }`.

------------------------------------------------------------------------

## 4.5 `icps`

**Purpose:** Target-market criteria used to discover and evaluate
prospects.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  name: string,
  description?: string,
  criteria: {
    industries: string[],
    countries: string[],
    regions?: string[],
    employeeRanges?: string[],
    revenueRanges?: string[],
    technologies?: string[],
    companyKeywords?: string[],
    excludedIndustries?: string[],
    excludedCompanies?: string[],
    targetJobTitles: string[],
    targetSeniority?: string[],
    contactLocations?: string[]
  },
  salesObjective?: string,
  isActive: boolean,
  createdBy: ObjectId,             // ref: users
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `name`, `criteria`,
`criteria.industries`, `criteria.countries`, `criteria.targetJobTitles`,
`isActive`, and `createdBy` are required. Empty arrays may be allowed if
the product supports progressively building an ICP. - `createdBy` must
have permission to create/edit ICPs in this startup. - Normalize
country/industry/title values consistently before sending them to
Apollo. - Do not assume every criterion maps to a supported Apollo
filter; validate/translate filters in the Apollo integration service. -
Enforce plan-specific ICP limits in application logic.

**Indexes** - `{ startupId: 1, isActive: 1 }`. -
`{ startupId: 1, createdAt: -1 }`.

------------------------------------------------------------------------

## 4.6 `prospects`

**Purpose:** Company-level records discovered from Apollo and evaluated
by AI Sales Copilot.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  icpId: ObjectId,                // ref: icps
  apolloOrganizationId?: string,
  name: string,
  domain?: string,
  websiteUrl?: string,
  industry?: string,
  employeeCount?: number,
  employeeRange?: string,
  revenueRange?: string,
  country?: string,
  region?: string,
  city?: string,
  technologies: string[],
  companyDescription?: string,
  linkedinUrl?: string,
  source: "apollo",
  sourceSnapshot?: object,        // selected, minimized fields only
  status:
    | "discovered"
    | "qualified"
    | "enriched"
    | "in_sequence"
    | "replied"
    | "meeting"
    | "disqualified"
    | "do_not_contact",
  qualificationReason?: string,
  lastEnrichedAt?: Date,
  lastApolloSyncAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `icpId`, `name`, `source`, `status`, and
`technologies` are required. - `icpId` must reference an ICP in the same
startup. - `source` is `"apollo"` in this MVP. - `employeeCount`, when
present, must be a non-negative integer. - `apolloOrganizationId` is the
preferred external duplicate key when provided. - Normalize domain to
lowercase and remove URL protocol/path for matching. - `sourceSnapshot`
must be allowlisted/minimized; do not blindly persist full API
responses. - A `do_not_contact` status must block outbound operations
until a permitted, explicit policy-driven change occurs.

**Indexes** - Unique partial `{ startupId: 1, apolloOrganizationId: 1 }`
when `apolloOrganizationId` exists and is non-empty. -
`{ startupId: 1, icpId: 1, status: 1 }`. - `{ startupId: 1, domain: 1 }`
(non-unique).

------------------------------------------------------------------------

## 4.7 `decisionMakers`

**Purpose:** People/contacts associated with a company prospect.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  prospectId: ObjectId,           // ref: prospects
  apolloPersonId?: string,
  firstName: string,
  lastName?: string,
  fullName: string,
  jobTitle?: string,
  seniority?: string,
  department?: string,
  businessEmail?: string,
  emailStatus?: string,           // Apollo-provided value if available
  phone?: string,
  linkedinUrl?: string,
  country?: string,
  city?: string,
  isPrimary: boolean,
  outreachStatus:
    | "not_contacted"
    | "drafted"
    | "approved"
    | "in_sequence"
    | "replied"
    | "do_not_contact",
  lastEnrichedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `prospectId`, `firstName`, `fullName`,
`isPrimary`, and `outreachStatus` are required. - `prospectId` must
reference a prospect in the same startup. - `apolloPersonId` is the
preferred external duplicate key when present. - Normalize email to
lowercase and trim whitespace. - Do not infer that an email is verified
unless Apollo returns an explicit status supporting that claim. -
`do_not_contact` must block outbound actions for that contact. - Collect
only contact fields required for qualification and permitted outreach.

**Indexes** - Unique partial `{ startupId: 1, apolloPersonId: 1 }` when
`apolloPersonId` exists and is non-empty. -
`{ startupId: 1, prospectId: 1 }`. -
`{ startupId: 1, businessEmail: 1 }` (non-unique unless product policy
guarantees uniqueness).

------------------------------------------------------------------------

## 4.8 `leadScores`

**Purpose:** Immutable/versioned score results for a prospect against a
particular ICP.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  prospectId: ObjectId,           // ref: prospects
  icpId: ObjectId,                // ref: icps
  score: number,                  // 0–100
  category: "high" | "medium" | "low",
  breakdown: {
    industryFit: number,
    companySizeFit: number,
    geographyFit: number,
    technologyFit: number,
    decisionMakerFit: number,
    buyingSignalScore: number
  },
  reasons: string[],
  missingData: string[],
  scoringVersion: string,
  scoredAt: Date,
  createdAt: Date
}
```

**Constraints** - All references must belong to the same startup. -
`score` and each breakdown component must be numeric and within
`0–100`. - `category` must be derived from documented application
thresholds, not independently guessed. - `reasons` must be traceable to
available evidence/data. - `scoringVersion` is required to interpret
historical scores after the scoring algorithm changes. - `scoredAt` is
the scoring event time; score records should be append-only in normal
operation.

**Indexes** - `{ startupId: 1, prospectId: 1, scoredAt: -1 }`. -
`{ startupId: 1, icpId: 1, score: -1 }`.

------------------------------------------------------------------------

## 4.9 `buyingSignals`

**Purpose:** Record potential buying signals only when supported by
Apollo data or activity data available to the connected account.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  prospectId: ObjectId,            // ref: prospects
  decisionMakerId?: ObjectId,     // ref: decisionMakers
  signalType:
    | "company_growth"
    | "technology"
    | "leadership"
    | "contact_change"
    | "engagement"
    | "other",
  description: string,
  evidence: [{
    field: string,
    value: string
  }],
  source: "apollo",
  confidence?: number,             // 0–1
  detectedAt: Date,
  observedAt?: Date,
  status: "active" | "stale" | "dismissed",
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `prospectId`, `signalType`,
`description`, `evidence`, `source`, `detectedAt`, and `status` are
required. - `prospectId` and optional `decisionMakerId` must belong to
the same startup. - `source` is `"apollo"` in the MVP. - `confidence`,
if present, must be between `0` and `1` and must be based on an
explainable evaluation. Do not use a fabricated confidence score. - Each
signal must include supporting evidence. Do not save an inferred event
as a fact if no Apollo field/activity supports it. - Signal categories
are product-side classifications; they do not guarantee that Apollo
exposes all such data. If no signal is available, scoring can proceed
using other fit criteria. - Define staleness rules in application logic
and preserve dismissed status.

**Indexes** - `{ startupId: 1, prospectId: 1, detectedAt: -1 }`. -
`{ startupId: 1, status: 1 }`.

------------------------------------------------------------------------

## 4.10 `outreachCampaigns`

**Purpose:** Product-side campaign configuration and reference to a
sequence managed by Apollo.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,            // ref: startups
  icpId: ObjectId,                 // ref: icps
  name: string,
  description?: string,
  objective: string,
  channel: "email",
  status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "active"
    | "paused"
    | "completed"
    | "cancelled",
  apolloSequenceId?: string,
  settings: {
    maxContacts?: number,
    followUpEnabled: boolean,
    followUpCount?: number
  },
  createdBy: ObjectId,             // ref: users
  approvedBy?: ObjectId,           // ref: users
  approvedAt?: Date,
  startedAt?: Date,
  completedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `icpId`, `name`, `objective`, `channel`,
`status`, `settings.followUpEnabled`, and `createdBy` are required. -
`icpId` must belong to the same startup. - `channel` is `"email"` in
this MVP. - `maxContacts` and `followUpCount`, if present, must be
non-negative integers within application limits. - `approvedBy` must be
an authorized member of the same startup. - Do not activate an outbound
sequence until approval is recorded and revalidated. -
`apolloSequenceId` is an external identifier, not a MongoDB reference.

**Indexes** - `{ startupId: 1, status: 1 }`. -
`{ startupId: 1, createdAt: -1 }`. -
`{ startupId: 1, apolloSequenceId: 1 }` (non-unique unless sequence
ownership semantics make uniqueness safe).

------------------------------------------------------------------------

## 4.11 `outreachMessages`

**Purpose:** Individual generated message drafts, approval decisions,
and outbound synchronization state.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,             // ref: startups
  campaignId: ObjectId,            // ref: outreachCampaigns
  prospectId: ObjectId,             // ref: prospects
  decisionMakerId: ObjectId,       // ref: decisionMakers
  messageType: "initial" | "follow_up" | "reply",
  subject?: string,
  body: string,
  personalizationContext?: {
    icpId?: ObjectId,
    leadScoreId?: ObjectId,
    buyingSignalIds?: ObjectId[],
    startupContextSummary?: string
  },
  approvalStatus:
    | "pending"
    | "approved"
    | "rejected"
    | "revision_requested",
  approvedBy?: ObjectId,           // ref: users
  approvedAt?: Date,
  status:
    | "draft"
    | "ready"
    | "queued"
    | "sent"
    | "delivered"
    | "replied"
    | "bounced"
    | "failed"
    | "cancelled",
  apolloSequenceId?: string,
  apolloContactId?: string,
  apolloMessageId?: string,
  sentAt?: Date,
  errorMessage?: string,
  createdBy: ObjectId,             // ref: users; system actor can be represented by a documented service identity
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `campaignId`, `prospectId`,
`decisionMakerId`, `messageType`, `body`, `approvalStatus`, `status`,
and `createdBy` are required. - All internal references must belong to
the same startup and the selected decision maker must belong to the
selected prospect. - `body` must be non-empty and length-limited. - For
email messages, require a non-empty subject before sending. -
`approvedBy` and `approvedAt` must be set only after a valid approval
action. - Before queueing/sending, re-check approval, tenant ownership,
prospect/contact do-not-contact state, and current campaign state. -
Failed retries must be idempotent; do not blindly repeat an external
create/send operation. - `apolloSequenceId`, `apolloContactId`, and
`apolloMessageId` are external identifiers. - Sanitize `errorMessage`;
never store tokens or sensitive headers.

**Indexes** - `{ startupId: 1, campaignId: 1, status: 1 }`. -
`{ startupId: 1, decisionMakerId: 1, createdAt: -1 }`. -
`{ startupId: 1, approvalStatus: 1 }`. - Optional unique partial index
on `{ startupId: 1, apolloMessageId: 1 }` when a stable message ID is
provided and uniqueness is guaranteed by Apollo.

------------------------------------------------------------------------

## 4.12 `salesActivities`

**Purpose:** Timeline of meaningful sales events, synchronized Apollo
activity, user actions, and product-generated events.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,             // ref: startups
  prospectId?: ObjectId,           // ref: prospects
  decisionMakerId?: ObjectId,      // ref: decisionMakers
  campaignId?: ObjectId,           // ref: outreachCampaigns
  messageId?: ObjectId,            // ref: outreachMessages
  activityType:
    | "prospect_discovered"
    | "contact_enriched"
    | "score_updated"
    | "signal_detected"
    | "message_approved"
    | "sequence_added"
    | "message_sent"
    | "message_replied"
    | "meeting_opportunity"
    | "status_changed"
    | "integration_error",
  source: "apollo" | "ai_sales_copilot" | "user",
  summary: string,
  details?: object,
  externalActivityId?: string,
  occurredAt: Date,
  createdAt: Date
}
```

**Constraints** - `startupId`, `activityType`, `source`, `summary`, and
`occurredAt` are required. - Every optional internal reference must
belong to the same startup. - Store only activities actually observed or
generated by the product; do not fabricate delivery, open, reply, or
meeting events. - Treat activities as append-only. Corrections should
use an explicit compensating event or documented administrative
process. - Minimize and sanitize `details`; do not store secrets or
unnecessary message content. - Deduplicate imported external events when
Apollo supplies a stable external event ID.

**Indexes** - `{ startupId: 1, occurredAt: -1 }`. -
`{ startupId: 1, prospectId: 1, occurredAt: -1 }`. - Unique partial
`{ startupId: 1, externalActivityId: 1 }` when the external ID is
present and stable.

------------------------------------------------------------------------

## 4.13 `nextBestActions`

**Purpose:** Store AI-generated action recommendations for founders.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,             // ref: startups
  prospectId: ObjectId,            // ref: prospects
  decisionMakerId?: ObjectId,      // ref: decisionMakers
  campaignId?: ObjectId,            // ref: outreachCampaigns
  actionType:
    | "follow_up"
    | "send_reply"
    | "share_information"
    | "book_meeting"
    | "nurture"
    | "stop_outreach"
    | "review_prospect",
  title: string,
  explanation: string,
  priority: "low" | "medium" | "high",
  basedOnActivityIds: ObjectId[],
  status: "pending" | "accepted" | "dismissed" | "completed" | "expired",
  suggestedMessageId?: ObjectId,   // ref: outreachMessages
  dueAt?: Date,
  resolvedBy?: ObjectId,           // ref: users
  resolvedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Constraints** - `startupId`, `prospectId`, `actionType`, `title`,
`explanation`, `priority`, `basedOnActivityIds`, and `status` are
required. - `prospectId`, optional `decisionMakerId`, `campaignId`, and
`suggestedMessageId` must belong to the same startup. - Every
`basedOnActivityIds` item must reference an activity in the same
startup. - Recommendations must explain the evidence or events that
prompted them. - AI recommendations do not authorize outbound execution;
the message approval and do-not-contact checks remain mandatory. - Set
`resolvedAt` and `resolvedBy` when a user resolves an action, as
appropriate.

**Indexes** - `{ startupId: 1, status: 1, priority: -1 }`. -
`{ startupId: 1, dueAt: 1 }`. -
`{ startupId: 1, prospectId: 1, createdAt: -1 }`.

------------------------------------------------------------------------

## 4.14 `usageRecords`

**Purpose:** Append usage events for Apollo operations and LLM requests,
supporting cost reporting and budget guardrails.

``` ts
{
  _id: ObjectId,
  startupId: ObjectId,             // ref: startups
  provider: "apollo" | "llm",
  operation: string,
  status: "success" | "failed" | "blocked",
  requestId?: string,
  unitsConsumed?: number,
  creditsConsumed?: number,
  inputTokens?: number,
  outputTokens?: number,
  costAmount?: number,
  currency?: string,
  metadata?: {
    prospectId?: ObjectId,
    campaignId?: ObjectId,
    errorCode?: string
  },
  occurredAt: Date,
  createdAt: Date
}
```

**Constraints** - `startupId`, `provider`, `operation`, `status`, and
`occurredAt` are required. - Numeric usage and cost fields, when
present, must be non-negative. - `currency` must use a documented
currency code when `costAmount` is present. - Distinguish estimated cost
from provider-reported cost in metadata or a future explicit field; do
not present estimates as exact charges. - Log blocked operations when
budget/rate guardrails prevent a request. - Do not assume all Apollo
endpoints report the same credit usage. Record provider-reported values
when available and clearly distinguish unknown values. - Do not store
credentials or full sensitive request/response bodies in metadata.

**Indexes** - `{ startupId: 1, occurredAt: -1 }`. -
`{ startupId: 1, provider: 1, operation: 1, occurredAt: -1 }`. -
Optional `{ startupId: 1, requestId: 1 }` when request IDs are
available. Make this unique only if request ID semantics guarantee one
record per request.

------------------------------------------------------------------------

## 5. Relationship model

### 5.1 Relationship summary

  ----------------------------------------------------------------------------------------------------
  Parent                Child / link          Cardinality       Relationship field
  --------------------- --------------------- ----------------- --------------------------------------
  `users`               `startups`            One user may own  `startups.ownerUserId`
                                              multiple startups 

  `users`               `startupMembers`      One user may have `startupMembers.userId`
                                              many memberships  

  `startups`            `startupMembers`      One startup has   `startupMembers.startupId`
                                              many members      

  `startups`            `integrations`        One Apollo        `integrations.startupId`
                                              integration per   
                                              startup in MVP    

  `startups`            `icps`                One-to-many       `icps.startupId`

  `icps`                `prospects`           One-to-many       `prospects.icpId`

  `startups`            `prospects`           One-to-many       `prospects.startupId`

  `prospects`           `decisionMakers`      One-to-many       `decisionMakers.prospectId`

  `prospects`           `leadScores`          One-to-many score `leadScores.prospectId`
                                              history           

  `icps`                `leadScores`          One-to-many score `leadScores.icpId`
                                              history           

  `prospects`           `buyingSignals`       One-to-many       `buyingSignals.prospectId`

  `icps`                `outreachCampaigns`   One-to-many       `outreachCampaigns.icpId`

  `outreachCampaigns`   `outreachMessages`    One-to-many       `outreachMessages.campaignId`

  `prospects`           `outreachMessages`    One-to-many       `outreachMessages.prospectId`

  `decisionMakers`      `outreachMessages`    One-to-many       `outreachMessages.decisionMakerId`

  Sales entities        `salesActivities`     Zero-to-many      Optional entity reference fields
                                              events            

  `prospects`           `nextBestActions`     One-to-many       `nextBestActions.prospectId`
                                              recommendations   

  `salesActivities`     `nextBestActions`     Many activities   `nextBestActions.basedOnActivityIds`
                                              can support an    
                                              action            

  `startups`            `usageRecords`        One-to-many       `usageRecords.startupId`
  ----------------------------------------------------------------------------------------------------

### 5.2 Mermaid ER diagram

``` mermaid
erDiagram
    USERS ||--o{ STARTUPS : owns
    USERS ||--o{ STARTUP_MEMBERS : joins
    STARTUPS ||--o{ STARTUP_MEMBERS : has
    STARTUPS ||--o{ INTEGRATIONS : connects
    STARTUPS ||--o{ ICPS : defines
    ICPS ||--o{ PROSPECTS : targets
    STARTUPS ||--o{ PROSPECTS : owns
    PROSPECTS ||--o{ DECISION_MAKERS : contains
    PROSPECTS ||--o{ LEAD_SCORES : receives
    ICPS ||--o{ LEAD_SCORES : evaluates
    PROSPECTS ||--o{ BUYING_SIGNALS : has
    ICPS ||--o{ OUTREACH_CAMPAIGNS : informs
    OUTREACH_CAMPAIGNS ||--o{ OUTREACH_MESSAGES : contains
    PROSPECTS ||--o{ OUTREACH_MESSAGES : targets
    DECISION_MAKERS ||--o{ OUTREACH_MESSAGES : receives
    PROSPECTS ||--o{ SALES_ACTIVITIES : records
    PROSPECTS ||--o{ NEXT_BEST_ACTIONS : suggests
    STARTUPS ||--o{ USAGE_RECORDS : consumes
```

The diagram is a logical relationship view. MongoDB does not enforce
these foreign-key relationships automatically.

------------------------------------------------------------------------

## 6. Critical cross-document constraints

Enforce these rules in service functions and tests, not just in Mongoose
field declarations.

1.  **Tenant consistency:** every referenced document must have the same
    `startupId` as the current operation.
2.  **Membership authorization:** the user must have an active
    membership for the startup; check the role for privileged
    operations.
3.  **Prospect--contact consistency:** an outreach message's
    `decisionMakerId` must belong to its `prospectId`.
4.  **ICP consistency:** a prospect, lead score, or campaign must
    reference an ICP in the same startup.
5.  **Campaign consistency:** an outreach message's campaign must belong
    to the same startup, and its prospect/contact must be eligible for
    that campaign.
6.  **Signal consistency:** every buying signal must reference a
    prospect in the same startup; an optional decision maker must belong
    to that prospect.
7.  **Action evidence:** each activity referenced by a next-best action
    must belong to the same startup.
8.  **Approval before execution:** validate current message approval,
    campaign approval/state, tenant authorization, and do-not-contact
    status immediately before calling Apollo.
9.  **Duplicate external operations:** use idempotency keys or an
    operation ledger where available; never assume a network timeout
    means Apollo did not process a request.
10. **Deletion behavior:** define explicit cleanup/retention behavior
    for related records. Prefer archive/status transitions for sales
    history unless deletion is required by policy or law.

------------------------------------------------------------------------

## 7. Data lifecycle and operational behavior

### 7.1 Prospect discovery and enrichment

-   Search Apollo using translated ICP criteria.
-   Normalize and deduplicate company records.
-   Save discovered prospects with the originating `startupId` and
    `icpId`.
-   Score available data before enriching contacts where possible.
-   Enrich only selected/high-priority records to control credit usage.
-   Update the prospect/contact's last-sync or last-enrichment
    timestamps.
-   Preserve prior score history in `leadScores`.

### 7.2 Buying signals

-   Create a signal only when available Apollo data or activity supports
    it.
-   Save the supporting field/value evidence.
-   Do not treat a general company attribute as proof of purchase
    intent.
-   If no signal is available, keep the signal list empty and continue
    scoring based on other available factors.
-   Mark signals stale using a documented rule; do not silently rewrite
    their evidence.

### 7.3 Outreach and activities

-   Generate message drafts and persist them as pending approval.
-   Record who approved the message and when.
-   Before adding contacts to an Apollo sequence, re-check approval,
    tenant ownership, campaign status, and do-not-contact flags.
-   Store external Apollo IDs when available.
-   Import only activity types the connected Apollo account and API
    expose.
-   Deduplicate synchronized activity events.
-   Use `nextBestActions` for recommendations rather than embedding
    recommendation history into a prospect.

### 7.4 Usage guardrails

-   Record usage for each relevant Apollo/LLM operation, including
    failures and blocked requests.
-   Check applicable plan/budget limits before expensive operations.
-   Treat usage records as an operational ledger; corrections should be
    explicit rather than silently overwriting historical usage.
-   If exact provider usage/cost is unavailable, store `null` or an
    explicitly labeled estimate rather than inventing a value.

------------------------------------------------------------------------

## 8. Security and privacy requirements

-   Hash passwords with bcrypt using appropriate configuration.
-   Encrypt Apollo access/refresh tokens at rest; keep encryption keys
    outside the database.
-   Never expose Apollo credentials to the frontend or logs.
-   Apply JWT authentication and startup membership authorization to
    protected endpoints.
-   Use least-privilege Apollo scopes and customer-authorized
    connections.
-   Minimize stored contact information and restrict access to it.
-   Sanitize error logs and AI/provider payloads.
-   Implement rate limits, timeouts, bounded retries with backoff, and
    idempotent handling for external operations.
-   Provide a reliable disconnect process for Apollo and prevent future
    requests after disconnection.
-   Verify the commercial terms and permissions for the intended
    multi-tenant use of Apollo data before customer-facing launch.

------------------------------------------------------------------------

## 9. Implementation and test checklist

### Schema and indexes

-   [ ] Create all 14 Mongoose models.
-   [ ] Add enums, required fields, field bounds, defaults, and
    timestamps.
-   [ ] Add the indexes specified in this document.
-   [ ] Test partial unique indexes for missing/empty Apollo IDs.
-   [ ] Add schema validation for all score and usage numeric ranges.

### Tenant security

-   [ ] A user from Startup A cannot read Startup B's prospects.
-   [ ] A user from Startup A cannot update or delete Startup B's
    records.
-   [ ] Cross-tenant references are rejected.
-   [ ] An inactive member cannot access workspace data.
-   [ ] Only authorized roles can connect Apollo or approve
    campaigns/messages.

### Apollo integration

-   [ ] Tokens are encrypted and never returned by API handlers.
-   [ ] Duplicate company/contact imports are suppressed.
-   [ ] Enrichment is performed only after prioritization/selection.
-   [ ] API failures, rate limits, retries, and usage are recorded.
-   [ ] External sequence/activity IDs are persisted when available.

### Outreach safety

-   [ ] A message cannot be queued/sent without valid approval.
-   [ ] A do-not-contact prospect/contact cannot enter outbound
    execution.
-   [ ] Retry after timeout does not create unintended duplicate
    actions.
-   [ ] Activity synchronization does not duplicate the same external
    event.
-   [ ] AI recommendations never bypass the approval checks.

------------------------------------------------------------------------

## 10. Explicitly out of scope for this MVP

The following are not separate collections in this baseline:

-   Separate `leads` collection.
-   Separate `replies` collection.
-   Separate external news, hiring, website-monitoring, or
    technology-signal providers.
-   Separate subscription/payment ledger.
-   Separate calendar/meeting collection.
-   Separate generic audit-log collection.

If later requirements need independent billing reconciliation, calendar
synchronization, long-lived job execution, detailed security audit
trails, or additional signal providers, add collections deliberately
rather than expanding these documents without a clear contract.

------------------------------------------------------------------------

## 11. Final decision

The MVP database consists of **14 collections**:

`users`, `startups`, `startupMembers`, `integrations`, `icps`,
`prospects`, `decisionMakers`, `leadScores`, `buyingSignals`,
`outreachCampaigns`, `outreachMessages`, `salesActivities`,
`nextBestActions`, and `usageRecords`.

The non-negotiable design constraints are strict tenant isolation,
same-tenant reference validation, evidence-backed intelligence,
Apollo-only external sales data for this phase, usage tracking,
duplicate suppression, and founder approval before outbound execution.

This document defines the logical database contract. Before release,
verify actual Apollo fields, OAuth scopes, API access, sequence/activity
capabilities, and commercial permissions against the connected account
and current Apollo terms.
