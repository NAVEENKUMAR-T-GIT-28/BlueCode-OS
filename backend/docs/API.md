# BlueCode OS Internal API

Base URL: `/api`  
Protected endpoints require `Authorization: Bearer <JWT>`.

## Health and authentication
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/register` | Create account + startup + 15-day trial; body `{name,email,password}` |
| POST | `/auth/login` | Login; body `{email,password}` |
| GET | `/auth/me` | Current authenticated user |

## Workspace and startup
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/workspace` | Return UI-compatible workspace assembled from normalized tables |
| PUT | `/workspace` | Save UI-compatible workspace snapshot; body `{state}` |
| GET | `/startup` | Startup profile and current subscription |
| PATCH | `/startup` | Update company/product/geography/customers/booking URL/setup flag |

## ICP
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/icp` | Get latest ICP |
| PUT | `/icp` | Create/update ICP; edits reset approval |
| POST | `/icp/approve` | Approve current ICP |

## Prospects, signals and decision makers
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/prospects` | List/filter/search/sort/page prospects |
| POST | `/prospects` | Create one prospect or `{prospects:[...]}` (max 50) |
| GET | `/prospects/:id` | Prospect with signals, decision makers and outreach |
| PATCH | `/prospects/:id` | Update prospect and pipeline status |
| DELETE | `/prospects/:id` | Delete prospect and dependent records |
| PUT | `/prospects/:id/signals` | Replace trigger/buying-signal/intent evidence |
| GET | `/prospects/:id/decision-makers` | List contacts |
| POST | `/prospects/:id/decision-makers` | Create one contact or `{contacts:[...]}` (max 10) |
| PATCH | `/prospects/:id/decision-makers/:dmId` | Update contact |
| DELETE | `/prospects/:id/decision-makers/:dmId` | Delete contact |

Prospect list query parameters: `priority=Hot,High`, `status=Contacted`, `q=term`, `sort=score|company|created|updated`, `order=asc|desc`, `page=1`, `limit=25`.

## Outreach and follow-ups
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/outreach` | List outreach; optional `prospect_id` and `status` filters |
| POST | `/outreach` | Create draft; body includes `prospect_id`, optional `decision_maker_id`, `subject`, `body` |
| PATCH | `/outreach/:id` | Edit draft subject/body (drafts only) |
| POST | `/outreach/:id/approve` | Approve draft; does not send an email |
| POST | `/outreach/:id/replies` | Record pasted reply and classify with simple keyword fallback |
| PATCH | `/outreach/:id/replies/:replyId` | Save response draft / reply metadata |
| POST | `/outreach/:id/follow-ups` | Create/update sequence 1 or 2 record; does not send |
| DELETE | `/outreach/:id` | Delete outreach record |
| PATCH | `/follow-ups/:id` | Update follow-up status/content/date |
| DELETE | `/follow-ups/:id` | Delete follow-up record |
| GET | `/follow-ups` | List follow-up records; optional `status` |

## Dashboard, activity, usage and integrations
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Dashboard counters and recent activity |
| GET | `/activities` | Activity feed; optional `limit` |
| GET | `/usage` | Usage totals and subscription summary; limits are not enforced |
| GET | `/integrations/status` | Reports external integrations as unconfigured |

## External integration placeholders
`/hunter/*`, `/ai/*`, `/email/*`, and `/payments/*` return HTTP 501. No external requests are made.

## Response and errors
Success responses use JSON. Typical errors: `400` validation error, `401` missing/invalid JWT, `403` role denied, `404` not found, `409` state conflict, `500` server/database error, `501` integration not implemented.
