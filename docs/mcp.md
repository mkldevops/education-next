# MCP server

`POST /api/mcp` exposes this application to an agent — Claude Code, Codex — over the
Model Context Protocol. The intent is paper: an enrollment form, a class list, a payment receipt, a
teacher sheet is photographed, and the agent turns it into typed tool calls.

**The image never leaves the agent.** Vision runs client-side; the server receives fields, not
pixels, and validates them with the same Zod schemas as a dashboard form. Nothing here is an upload
endpoint.

The rules this server enforces — who may hold a key, what a refusal means, why the platform flag
reads as disabled by absence — live in
[`business-rules.md`](./business-rules.md#machine-access-mcp). This page is the operating manual.

## Opening the surface

Two switches, both required.

1. A super-admin enables **MCP** in the Integrations section of `/dashboard/config`. The platform
   flag `mcp_enabled` is
   **off by default**; while it is off, `POST /api/mcp` answers `503 {"error":"mcpDisabled"}` before
   reading any credential.
2. A school admin creates a key in the **API keys** tab of `/dashboard/settings`. The tab exists
   only for an `ADMIN` (or a super-admin), and only while the flag is on.

A key belongs to one user **and one school**. It carries no school argument to any tool, so the same
agent pointed at two schools needs two keys.

## Creating a key

Give it a name and a lifetime — 30, 90 or 365 days, 90 by default. Expiry is mandatory.

The token appears **once**, in the form `edu_mcp_…`. Only its SHA-256 is stored, so a lost key is
replaced, never recovered. Five live keys per user and school; revoke one to make room.

Revoking takes effect on the next call: revocation, expiry, account deactivation and loss of the
`ADMIN` membership are all re-read on every request.

## Connecting a client

### Claude.ai video tutorial

In **Settings › API keys › Connected apps**, expand **Connect Claude.ai · Video tutorial**.
The French video, with French captions, is available before creating any key: the OAuth connection
does not need one. The guide also offers the current site's MCP URL to copy.

The approved ElevenLabs video and its poster/captions live in the private MinIO bucket configured
by `S3_*`, under `videos/connecter-claude-eic-elevenlabs-2026-11-01.mp4`,
`videos/connecter-claude-eic-2026-11-01.jpg`, and `videos/connecter-claude-eic-2026-11-01.fr.vtt`.
The authenticated `/api/tutorials/claude-connection/{video,poster,captions}` endpoint serves only
those three objects and supports byte ranges for seeking. No public bucket or expiring URL is needed.

### Client configuration

After a key is created, the tab offers four clients. Every snippet is built from the site the page is
served from: the URL is `<origin>/api/mcp`, and the server name carries the host —
`education-ecole-example-fr` for `https://ecole.example.fr` — so two deployments configured on the
same machine stay distinct. The key appears only in the Claude Code command and the Codex variable,
and disappears with the panel on reload or revocation.

| Client | Status | Route |
|---|---|---|
| Claude Code | available with a key | local command |
| Codex (CLI, IDE extension, desktop app) | available with a key | `~/.codex/config.toml` + environment variable |
| Claude Web (claude.ai, Claude Desktop connectors) | request headers (beta, some accounts) or OAuth | custom connector |
| ChatGPT | available through OAuth, no key | personal plugin in developer mode |

Claude Code, one command:

```bash
claude mcp add --transport http education-ecole-example-fr https://ecole.example.fr/api/mcp \
  --header "Authorization: Bearer edu_mcp_…"
```

Codex reads a `[mcp_servers.<name>]` table. The key stays out of the file: `bearer_token_env_var`
names the variable Codex sends as `Authorization: Bearer`.

```toml
[mcp_servers.education-ecole-example-fr]
url = "https://ecole.example.fr/api/mcp"
bearer_token_env_var = "EDUCATION_MCP_TOKEN_ECOLE_EXAMPLE_FR"
```

```bash
export EDUCATION_MCP_TOKEN_ECOLE_EXAMPLE_FR="edu_mcp_…"
```

The Codex CLI, IDE extension and Codex app share that file. ChatGPT on the web does not
read it.

Claude Web adds a server through **Customize › Connectors › + › Add custom connector**, with the
site's `/api/mcp` URL. The connection is brokered from Anthropic's cloud. Where the dialog shows a
**Request headers** section — a beta Anthropic opens to some accounts only — choose **No sign-in**
and send the key as `x-api-key`. Without it, the connector authenticates through the same OAuth
flow as ChatGPT, described below. On a Team or Enterprise plan a request header is one credential
shared by the whole organization, so a personal key does not belong there. The tab shows the route
and the URL, never the key inside a command.

ChatGPT never takes a key: it links the account through OAuth, from the **Connected apps** panel of
the same tab. See [Personal ChatGPT connection (OAuth)](#personal-chatgpt-connection-oauth).

A client that only speaks stdio goes through `mcp-remote`:

```json
{
  "mcpServers": {
    "education": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-instance.example/api/mcp",
        "--header", "Authorization: Bearer edu_mcp_…"
      ]
    }
  }
}
```

Some clients reserve `Authorization` for their own OAuth flow. `X-API-Key: edu_mcp_…` is accepted as
a fallback, and is read only when no `Authorization` header is present.

Locally the URL is `http://localhost:8550/api/mcp`.

## Personal ChatGPT connection (OAuth)

ChatGPT connects to this server as a personal plugin and authenticates through OAuth 2.1, the
route OpenAI documents for MCP connectors. The server is its own authorization server: no external
identity provider, no shared secret, no key to paste. What ChatGPT holds is a **connection** — one
user, one school, one site — that the administrator grants on a consent page and can revoke at any
time.

### One connection per site

A deployment is selected by its URL and by nothing else. `https://ecole-a.example/api/mcp` and
`https://ecole-b.example/api/mcp` are two plugins in ChatGPT, each with its own consent and its own
tokens: a token issued by site A carries site A's `/api/mcp` URL as its audience and is refused by
site B as unauthenticated, before any user or school is read. No tool takes a site or a school
argument, so ChatGPT cannot be talked into routing a request elsewhere.

The URL must be HTTPS, because ChatGPT reaches the site from OpenAI's infrastructure and the
consent page is served to the administrator's browser. Locally, the flow works on
`http://localhost:8550` only for clients that run on the same machine (the MCP Inspector, for
instance); ChatGPT itself needs a public HTTPS origin.

### Prerequisites

1. The platform flag **MCP** is on (`/dashboard/config`, Integrations, super-admin). While it is off,
   registration and token exchange answer `503 temporarily_unavailable`, the consent page refuses,
   and existing tokens are refused by `/api/mcp` like a key would be.
2. The person linking the account is an **`ADMIN` of the school** to connect (or a super-admin). A
   parent, a teacher, or an admin of another school sees no school to pick and cannot grant.

### Linking

1. In ChatGPT, turn on **Settings › Security and login › Developer mode**.
2. **Plugins › +**: name the connection after the site (the tab suggests
   `education-ecole-example-fr`), paste `<origin>/api/mcp`, choose **OAuth** authentication.
   ChatGPT discovers the rest — the metadata documents below — and registers itself as a client;
   there is no client ID or secret to enter.
3. ChatGPT opens `<origin>/oauth/authorize` in the browser. Sign in if needed (the request is
   replayed after login), pick the **school** the connection will administer, and **Authorize**. The
   page names the client, the account, the school, the permissions granted and, highlighted, the
   host the browser will return to — authorize only if you recognize it. **Deny** creates nothing
   and shows a **Return to** link that reports `access_denied` to the application.
4. ChatGPT is sent back to its callback with a one-shot code and exchanges it for tokens. The
   connection now appears under **Connected apps** in the API keys tab of `/dashboard/settings`,
   with the client's name, the grant date and the last use.

The same person can link several schools: one plugin per site, one consent per school, and each
connection is listed on the school it was granted for.

### What the connection can do

Exactly what a key can, on the chosen school and on it alone: the read tools, the class planning,
the events, and the `preview_*`/`commit_*` pairs. Drafts prepared through a connection carry
`ownerKind: OAUTH_GRANT` and are `draftNotFound` for a key or for the dashboard assistant, and the
reverse, even for the same administrator. Payment tools appear only when payments are enabled for
the school, as for a key.

Every call re-resolves the connection: the access token's expiry, the connection's revocation, the
account, the school's activity, the `ADMIN` membership, the platform flag and the audience are
re-read each time. Losing the membership makes the connection answer `403 forbidden` on the next
call, without waiting for the token to expire.

### Tokens

| Secret | Prefix | Lifetime | Use |
|---|---|---|---|
| authorization code | `edu_oac_` | 5 minutes, one exchange | returned to ChatGPT's callback |
| access token | `edu_oat_` | 1 hour | `Authorization: Bearer` on `/api/mcp` |
| refresh token | `edu_ort_` | 30 days, rotated at each use | `grant_type=refresh_token` on the token endpoint |

Only the SHA-256 of each secret is stored. A code or a refresh token presented twice revokes the
whole connection: a replay means the secret leaked, and the legitimate client reconnects with one
consent. Expired secrets are swept in the background on the MCP route, like drafts; the connection
row itself stays, revoked or not, as the trace the tab shows.

### Revoking

- **From the dashboard**: Connected apps › revoke. The connection answers `401` on its next call,
  access token still valid or not, and ChatGPT proposes to reconnect.
- **From the client**: ChatGPT (or any client) may call `POST /api/mcp/oauth/revoke` with
  `token=<access or refresh token>` and its `client_id` (RFC 7009). The whole connection is revoked,
  and the endpoint answers `200 {}` whether the token was known or not. A missing `client_id`, or a
  token issued to another client, answers `401 invalid_client` and revokes nothing.
- Deactivating the account or the school, or withdrawing the `ADMIN` role, refuses the connection
  on the next call without touching it; it can be revoked afterwards for the record.

A revoked connection is never deleted, and it blocks the permanent deletion of its holder's account
like a key does (`hasRelatedRecords`).

### Endpoints

| Path | Standard | Role |
|---|---|---|
| `/.well-known/oauth-protected-resource` and `…/api/mcp` | RFC 9728 | names `/api/mcp` as the resource and this origin as its authorization server |
| `/.well-known/oauth-authorization-server` | RFC 8414 | authorization, token, registration and revocation endpoints; `S256` only; public clients only |
| `POST /api/mcp/oauth/register` | RFC 7591 | dynamic registration: `client_name`, HTTPS `redirect_uris` (or loopback `http://localhost`), `token_endpoint_auth_method: none` |
| `GET /oauth/authorize` | RFC 6749 §3.1, PKCE (RFC 7636) | consent page, `response_type=code`, `code_challenge_method=S256`, optional `resource` (RFC 8707) that must be this site's `/api/mcp` |
| `POST /api/mcp/oauth/token` | RFC 6749 §4.1.3, §6 | code exchange (`code_verifier`, `redirect_uri`, `client_id`) and refresh rotation |
| `POST /api/mcp/oauth/revoke` | RFC 7009 | `token` + `client_id`: revokes the connection behind the token, only for the client it was issued to |

An unauthenticated `POST /api/mcp` answers `401` with
`WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`, and
`error="invalid_token"` when a well-formed but refused token was presented: that header is how a
client finds the authorization server. The origin comes from `NEXT_PUBLIC_APP_URL`, never from the
`Host` header, so a request forged with another host still points at this site.

### Expected errors

On the consent page:

| Message | Cause |
|---|---|
| The application asking for access is not registered on this site | unknown `client_id` — registration happened on another site, the flag was off when ChatGPT tried, or the client was purged after a day without any connection (reconnect from ChatGPT to register again) |
| The application's return address does not match its registration | `redirect_uri` outside the registered list |
| The authorization request is incomplete or altered | missing `client_id` or `redirect_uri`; or missing PKCE, a method other than `S256`, a scope other than `school:admin`, a `resource` naming another site — then a **Return to** link carries the OAuth error back to the application, and nothing redirects on its own |
| You administer no school on this site | the signed-in account is not `ADMIN` anywhere on this site |
| The MCP server is disabled on this instance | flag off |
| Unavailable while signed in as another user | a super-admin impersonating cannot grant on behalf of the target |

On the token endpoint, RFC 6749 §5.2 bodies: `invalid_grant` (unknown, expired, consumed or
mismatched code or refresh token, wrong `code_verifier`, wrong `redirect_uri`), `invalid_client`
(`401`, code issued to another client), `invalid_target` (`resource` names another site),
`unsupported_grant_type`, `invalid_request`, `too_many_requests` (`429`), `temporarily_unavailable`
(`503`, flag off).

On `/api/mcp`, the same refusals as a key: `401 unauthorized` (missing, malformed, expired or
revoked token, revoked connection, token issued for another site), `403 forbidden` (deactivated
account or school, membership no longer `ADMIN`), `503 mcpDisabled`, `429 tooManyRequests`.

### Demo: one administrator, two sites

1. Deploy two instances, `https://ecole-a.example` and `https://ecole-b.example`, each with its own
   `NEXT_PUBLIC_APP_URL`, and enable MCP on both.
2. In ChatGPT, add two plugins — `education-ecole-a-example` and `education-ecole-b-example` — each
   with its own `/api/mcp` URL and OAuth. Each opens its own consent page; pick the school on each.
3. Ask ChatGPT to enroll a family from a photographed form on site A: `preview_enroll_family` then,
   after the plan is validated, `commit_enroll_family`. Repeat on site B. Each write lands on the
   school chosen at consent, and `describe_school` on each plugin names that school.
4. Revoke the site A connection from its Connected apps panel: the site A plugin answers `401` and
   asks to reconnect; the site B plugin is untouched. Presenting the site B token to site A (with
   `curl`) answers `401` with `error="invalid_token"`.

## Checking the connection

```bash
curl -s -X POST https://your-instance.example/api/mcp \
  -H "Authorization: Bearer edu_mcp_…" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18",
       "capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

The session is stateless, so `tools/list` may follow in a second call with the same headers.

Expected refusals: `503 mcpDisabled` (flag off), `401 unauthorized` (missing, malformed, unknown,
revoked or expired key), `403 forbidden` (deactivated account or school, or a membership that is not
`ADMIN`), `429 tooManyRequests`, `405 methodNotAllowed` on anything but `POST`.

## Configuring plan prices and payment tracking

When payments are enabled, `create_plan` and `update_plan` use the same validation and tenant-scoped
operations as the dashboard. Their arguments cannot select a school: the authenticated administrative
scope supplies it. The built-in assistant shares these tools and requires its normal confirmation
before a write.

- `create_plan` takes `name`, optionally an annual `amount`, and/or `pricing`. Use
  `{ "mode": "ANNUAL", "amount": 1000 }` or
  `{ "mode": "MONTHLY", "amount": 100, "months": 10 }`. The latter computes an annual total of 1000.
  Prices are in the school's currency units, never cents.
- `update_plan` takes an `id` from `list_plans` and the fields to change. A price change preserves
  existing enrollment totals. A payment-schedule change applies to their next tracking calculation.
- `paymentSchedule` is independent from the price basis. Choose `{ "mode": "NONE" }` to disable
  overdue tracking; legacy plans with a null schedule also have no tracking. For monthly tracking use
  `{ "mode": "MONTHLY", "firstMonth": 9, "count": 10, "dueDay": 5 }`; for quarterly tracking use
  `QUARTERLY` with at most four installments. Monthly tracking accepts at most twelve installments.
  Custom tracking accepts one to five dates, for example
  `{ "mode": "INSTALLMENTS", "dates": [{ "month": 9, "day": 5 }, { "month": 12, "day": 5 }] }`.
  Months are relative to the enrollment's school period; short months clamp the due day to month end.
  The deadline day remains available to pay: arrears start the following school-local day.

These schedules define expected payments, not a limit on the number of payment records. A family may
pay early or in several partial payments. `get_family_payments` distinguishes the full remaining
balance from `tracking.overdueAmount`, the unpaid portion of elapsed installments. A plan without
tracking never labels an annual balance as overdue. Typed refusals include `validationError`,
`paymentsDisabled`, `unpricedPlan`, and `notFound` when updating an unknown or inaccessible plan.

## Read tools

Every one of them works in the key's school. Only the last three take arguments.

| Tool | Publishes |
|---|---|
| `describe_school` | `id`, `name`, `slug` |
| `list_levels` | `id`, `name`, `nextLevels [{ id, name }]` |
| `list_periods` | `id`, `name`, `startAt`, `endAt` |
| `list_class_periods` | `id`, `name`, `capacity`, `level { id, name }`, `period { id, name }`, `teachers[].teacher { id, firstName, lastName }` |
| `list_plans` | `id`, `name`, `amount` (annual total, decimal string, not cents), `pricing`, `paymentSchedule` |
| `list_teachers` | `id`, `firstName`, `lastName` |
| `find_students` (`query`, `limit?`) | `id`, `name`, `lastname`, `families[] { id, name }`, open `enrollments[]` with `plan` and `classes` |
| `get_family_payments` (`familyId`) | `family`, `remainingBalance`, `paidAmount`, `tracking` (`expectedToDate`, `overdueAmount`, `paidToDate`, `tracked`), per-enrollment balances, and the 20 latest active payments with `id`, `amount`, `method`, `paidAt`, `online` (money tools only) |

They are the resolution layer: a label read on paper — "CE1 / 2026-2027", the name of a plan —
becomes an identifier through these lists, before any write is attempted. That is also why the
columns above are the whole of it: a teacher's `email` and `phone` are never published, because
resolving a paper form needs an identity, not a way to contact anyone. Every column is named in
`src/gateways/mcp-read-gateway.ts`, so widening the surface is an edit to that file, not a
side effect of a schema change.

## Creating levels and classes

`create_level { name }` creates an active level in the connected school and returns its `id`
and `name`. An active level of the same name is refused with `nameTaken`; read `list_levels`
before creating or retrying.

`create_class_period { name, capacity, levelId, periodId, teacherIds? }` creates a class and
returns `id`, `name`, `capacity`, `levelId` and `periodId`. Resolve identifiers from `list_levels`,
`list_periods` and, for optional teachers, `list_teachers`. Capacity must be a positive integer
confirmed by the school, not a value inferred from the number of students in an imported file.
The dashboard rules apply: one class per level and period (`levelAlreadyAssigned`), and every
level, period and teacher must belong to the connected school (`levelNotFound`, `periodNotFound`,
`teacherNotFound`). Both tools trim names and return `validationError` for invalid input.

These are immediate, non-destructive writes, available even when payments are disabled, and
shared with the dashboard assistant. Neither tool accepts a school identifier. They create no
students, enrollments, payment plans or payments. Re-read the lists after a network error before
retrying a creation.

## Deleting a family and archiving resources

`get_family_deletion_impact { id }` is read-only. It returns the scoped family (`id`, `name`),
including archived families, and the counts of exclusive members, students, enrollments,
payments and attendance entries that deletion would remove. It creates no draft. The counts
are an observation of the current state, not a reservation or a complete audit of every table.

After presenting that impact and obtaining explicit approval, `delete_family { id, confirmation }`
permanently deletes the family using the dashboard deletion use case. `confirmation` must match
the family name (trimmed and case-insensitive). The transaction also removes its exclusive members,
students, enrollments, payments, receipts and transactions. People linked to another family survive.
No archive prerequisite. Success is `{ id, deleted: true }`; expected refusals are `notFound`,
`confirmationMismatch`, `deletionBlocked`, `deletionConflict` and `validationError`. After an uncertain
network result, re-read the family instead of deleting a replacement or retrying by name.

The following tools take `{ id }` and return `{ id, archived: true }`. They archive rather than
permanently deleting records, reusing the dashboard protections:

| Tool | Refuses |
|---|---|
| `archive_student` | An active or pending enrollment (`hasActiveEnrollments`); stops meal services on success |
| `archive_class_period` | Any student/teacher assignment, schedule slot or attendance session (`classInUse`) |
| `archive_level` | Any active class (`levelInUse`); removes progression links on success |
| `archive_plan` | An open enrollment (`planInUse`), the reserved unpriced plan (`unpricedPlan`), or disabled payments (`paymentsDisabled`) |

Missing or foreign resources return `notFound`; malformed input returns `validationError`.
All deletion and archive tools are immediate destructive writes in the shared catalogue, so the
dashboard assistant also requires its normal human approval. They never accept `schoolId`.
Archival does not modify enrollment amounts or record payments.

## Weekly class planning

The MCP can read and maintain the same recurring class slots as `/dashboard/planning`. It never
accepts a school identifier: the API key selects the school. Planning must be enabled for that
school (`class_schedule_enabled`), otherwise these tools return `notConfigured`.

| Tool | Input | Result |
|---|---|---|
| `list_class_schedule_slots` | `periodId` from `list_periods` | Slots with `id`, weekday, times, description, class identity and active teacher identities |
| `create_class_schedule_slot` | `classPeriodId` from `list_class_periods`, weekday, times, `teacherIds`, optional description | New slot `id` and overlap warnings |
| `update_class_schedule_slot` | Slot `id`, weekday, times, `teacherIds`, optional description; the class stays fixed | Slot `id` and overlap warnings |
| `delete_class_schedule_slot` | Slot `id` | `{ "deleted": true }` |

`weekday` follows ISO order: Monday is 1, Saturday 6 and Sunday 7. Times use 24-hour `HH:mm`
without a date or timezone. A slot repeats every week of its class period; its end time is excluded,
so `09:00–12:00` and `12:00–13:00` do not overlap. Use `teacherIds: []` for a class with no assigned
teacher. A teacher ID must already be assigned to the class. For example, the photographed Marseille
weekend schedule can be entered as separate slots for C1, C2, C3, C4, F/FG and H/GG; a description
can distinguish adults from older pupils on a shared class.

Creation and updating reuse the dashboard's time, class, teacher and overlap checks. Expected
refusals are `validationError`, `invalidTimeRange`, `classPeriodNotFound`, `teacherNotFound`,
`classOverlap`, `teacherOverlap`, and `notFound` for an unknown slot on update or delete. When teacher
overlap is allowed by the school's configuration, the write succeeds with a warning listing the
other slot IDs. Deleting a slot changes future expected attendance occurrences, so inspect the
current planning before using that tool.

A whole planning — the Saturday and Sunday of a school year read off one photograph — is entered
through the `class_schedule` preview/commit pair described below, not slot by slot: one refused slot
would otherwise leave a half-written weekend.

## Creating an event

`create_event` turns a dictated or photographed announcement into an event, in one call — there is no
preview/commit pair, because the event is born `DRAFT` and nobody sees it until an admin publishes it
from `/dashboard/events`. The tool accepts no `status`.

| Field | Shape |
|---|---|
| `title`, `category` | required; `category` is `MEETING`, `TERM_START`, `OUTING`, `HOLIDAY`, `CLOSURE`, `CELEBRATION` or `OTHER` |
| `startAt`, `endAt` | a day, `2026-12-03`, or a wall-clock time **without zone**, `2026-12-03T18:00` |
| `allDay` | optional; absent, a day-only `startAt` means all day and a time does not |
| `visibility` | optional, `PUBLIC`, `MEMBERS` (default) or `STAFF` |
| `summary`, `description`, `location`, `announceDaysBefore` | optional |

It runs the dashboard's own `createEvent`, so refusals are the dashboard's: `notConfigured` when the
school has not enabled events, `slugTaken` when an active event already has that title,
`invalidDateRange`, `validationError`. The result publishes `id`, `slug`, `title`, `category`,
`visibility`, `status`, `allDay`, `startAt`, `endAt`, `location`.

## Reading and correcting events

Four tools let an agent reread and fix what it dictated. They run the dashboard's own use cases, so
`events_enabled`, the date bounds and `slugTaken` behave exactly as on screen; a disabled school
gets `notConfigured` from each of them.

| Tool | Arguments | Publishes |
|---|---|---|
| `list_events` | optional `from`, `to` (inclusive days bounding `startAt`), `status`, `limit` (default 50, at most 100) | `events[]` with the columns of `create_event`'s result, `hasMore` |
| `get_event` | `id` | the same columns plus `summary`, `description`, `announceDaysBefore` |
| `update_event` | `id` and any field of `create_event`; `null` clears an optional one | the updated event |
| `duplicate_event` | `id`, a new `title` | the copy, one year later |

- `list_events` covers every status, so a draft created earlier is found with `status: "DRAFT"`.
  Archived events never appear. `to` before `from` is `invalidDateRange`.
- No event tool publishes an image. The media route serves an object key without checking the
  event's visibility or status, so a published key would expose a draft's poster.
- `update_event` only touches a `DRAFT` (`notDraft` otherwise) and accepts no `status`: publishing
  stays a dashboard action. The draft status is part of the write condition, so an admin publishing
  the event between the read and the write makes the tool fail (`internalError`) rather than edit a
  live event. Without `startAt` or `allDay`, the event keeps its `allDay`; a `startAt` sent alone
  follows the rule of `create_event`.
- `duplicate_event` is `duplicateEvent`: the copy is born `DRAFT`, without images, shifted by one
  year. The source may be published. Reusing the source title is refused with `slugTaken` — put the
  year in the new title.

## Reading attendance calls

`list_attendance_calls` rereads `/dashboard/attendance` day by day, so an agent can tell which call
is still to be taken or left open. It only reads: opening, entering, validating and cancelling a
call stay dashboard actions. A school without `attendance_enabled` gets `notConfigured`.

| Argument | Shape |
|---|---|
| `periodId` | required, from `list_periods`; another school's period is `notFound` |
| `classPeriodId` | optional, from `list_class_periods` |
| `from`, `to` | inclusive UTC days, `2026-09-26`; `to` defaults to `from`, 31 days at most |

The result is `days[]` with `date`, `closed` and `calls[]`; a day without any call is omitted. A call
publishes `classPeriod { id, name }`, `slotId`, `startTime`, `endTime`, `status`, `sessionId` and
`validatedAt`. `status` is `NOT_STARTED`, `IN_PROGRESS` or `VALIDATED` for a scheduled slot,
`CANCELLED` for a cancelled one; an exceptional call has a null `slotId`. On a closure day only the
calls already opened remain. No student, entry or roster is published. `to` before `from` is
`invalidDateRange`, a longer range `rangeTooLong`.

## Writing: the preview/commit pairs

Five pairs are shipped. `create_teacher` is shipped as a single write, without preview: it takes a
first and last name (email and phone optional) and creates the teacher with no class, as the dashboard
form does. An active teacher of the same name, in either order, or of the same email suspends the
creation: the tool answers `{ "created": false, "reason": "possibleDuplicate", "matches": [...] }`
with the identity of each match and writes nothing. Send `allowDuplicate: true` to create the
homonym anyway, once the human confirms it is someone else.

| Tool | Paper it matches | State |
|---|---|---|
| `enroll_family` | a full enrollment form: family, parents, students, enrollment, deposit — or, by `familyId`, children of a family already entered | shipped |
| `record_payment` | a receipt or payment slip | shipped |
| `update_enrollment` | a correction: a child moved to another plan, a discount granted | shipped |
| `class_schedule` | a whole weekly planning: every class, day, time and teacher of a period | shipped |
| `create_teacher` | a teacher sheet | shipped, single write (no preview) |
| `record_teacher_expense` | a teacher expense note: a receipt for snacks, supplies, goods | shipped |

The shape, and the reason for it:

```text
photo ──▶ agent extracts fields
      ──▶ preview_enroll_family(fields)
            → { draftId, checksum, plan, matches, warnings, blockers }
            → writes nothing but the draft
      ──▶ human reads the resolved plan
      ──▶ commit_enroll_family({ draftId, checksum })
            → family, parents, students, enrollment, payment
```

`preview_*` writes: it persists the resolved plan as a draft row, which is why neither preview is
annotated `readOnlyHint`. Nothing else is created.

`preview_*` normalizes, validates field by field — an agent must be able to correct its reading,
which an opaque `validationError` does not allow — resolves human labels into identifiers, and
probes for duplicates. It persists a draft and returns a 12-character checksum. A non-empty
`blockers` means no draft was written at all, so there is nothing to commit until the named field is
fixed. `warnings` never blocks: an existing namesake or a receipt number already banked is for the
human to judge.

The class is named on each student, not once on the family. A family sheet routinely spreads its
children across classes — "C4 / C2 / F" on a single line — and a single class at the root would
force the siblings into separate calls; each call creates a family, so the siblings would come back
as duplicates. An unresolved label is a blocker naming the child: `students.2.className`.

The plan follows the same logic, with a default. `planName` at the root is the family's plan; a
student may carry its own `planName` — an older child on a cheaper plan than its siblings — and each
enrollment is then priced on the plan its student resolved. The resolved plan carries `plan` and
`totalAmount` on every student, not once at the root. A label the student carries blocks as
`students.1.planName`; the family's label blocks once as `planName`, however many children fall back
on it. The discount applies to each enrollment, so it must fit the cheapest plan of the family.

Sex and birthday may be omitted, and `parents` may be empty or absent, when the sheet does not carry
them.

`familyId`, in place of `familyName`, enrolls children of a family already entered — its `id` comes
from `matches` or from `preview_record_payment`. A line naming a member of that family enrolls that
student instead of creating a namesake; a line naming nobody creates the child in the family. Parents
and emergency contact are refused alongside it: the family already owns them.

Dates are ISO strings, never anything else. A birthday is a day, `2018-04-02`. A payment date is a
day or a timestamp with seconds and a zone, `2026-09-12T14:30:00Z` or `2026-09-12T14:30:00+02:00`.
`02/04/2018` and a timestamp without a zone are refused.

`matches` reports what the duplicate probe found, projected by the use case, not by the dashboard
gateway it reads: a family is an `id` and a `name`. Only `enroll_family` probes people, so only it
carries `students` — a namesake is an `id`, both names and an `isStudent` flag. A namesake already
enrolled is named, never dated.

`commit_*` sends back the `draftId` and that checksum, not the payload: a model does not
re-serialize two kilobytes byte for byte. The checksum proves the resolved plan was read; a
single-pass lock makes a replay after a network cut return the recorded result instead of a second
family. A draft lives thirty minutes.

A draft belongs to the API key that proposed it. Another key of the same school — even one held by
the same person — is told the draft does not exist, because the plan carries the proposing key's
user as the author of everything it creates.

The result is written inside the same transaction as the data, so a draft that is `COMMITTED` with
no result wrote nothing. A refusal raised from inside that transaction aborts it, so a commit that
refuses after writing part of its work leaves none of it behind. That is the exit for a commit
killed mid-flight: after sixty seconds the lock is reclaimable, and a commit refused on a business
rule gives the lock back immediately.

A commit re-checks what the preview could only observe: class capacity is recounted, and a payment
split is recomputed against fresh balances. Two drafts prepared on the same free seat, or on the
same outstanding balance, cannot both land.

Refusals a commit can return, as `{ "error": … }` with `isError`:

| Body | Cause |
|---|---|
| `validationError` | malformed `draftId` or `checksum`, or a stored plan of an older shape |
| `draftNotFound` | unknown draft, a draft belonging to the other tool, or one proposed by another key |
| `draftExpired` | the thirty minutes ran out; run the preview again |
| `checksumMismatch` | the checksum does not match the plan that was shown |
| `commitInProgress` | a concurrent commit is still inside its transaction; retry |
| `notFound` | the class resolved by the preview no longer exists, or the enrollment or plan it targets |
| `teacherNotFound` | a teacher of the planning is no longer assigned to its class |
| `classOverlap` / `teacherOverlap` | a slot of the planning now overlaps one written since the preview; nothing was written |
| `classFull` | the class filled up between the preview and the commit |
| `overpayment` | the amount now exceeds what the family still owes |
| `noPayableEnrollments` | the family has no `PENDING` or `ACTIVE` enrollment left to pay |
| `refundExceedsPaid` | the refund now exceeds what was banked |
| `staleDraft` | the split no longer matches the fresh balances, or the enrollment or plan changed; preview again |
| `totalBelowPaid` | a payment banked since the preview exceeds the enrollment's new total |
| `internalError` | anything unexpected, with the detail kept server-side |

`update_enrollment` changes the plan, the discount, or both, on one `PENDING` or `ACTIVE`
enrollment. The enrollment is named by `enrollmentId`, or by `studentName` and `studentLastname`;
the plan by its label, like everywhere else. Without a `discount`, the enrollment keeps its own —
moving to another plan never silently erases a discount already granted. The total is recomputed
from the target plan's current price, and payments stay on the enrollment. The plan shows
`before`, `after`, what was already `paid` and what `remaining` is left. Its blockers:

| Reason | Cause |
|---|---|
| `notFound` / `ambiguousEnrollment` | no open enrollment, or several; `matches.enrollments` lists them with their `id` |
| `unknownPlan` / `ambiguousPlan` | the plan label resolves to no plan, or several |
| `discountExceedsPlan` | the discount is above the target plan |
| `totalBelowPaid` | the new total is below what was already banked on the enrollment |
| `noChange` | plan, discount and total are already those |

Its commit refuses with `staleDraft` when the enrollment or the target plan's price moved since the
preview, `notFound` when the enrollment is no longer open or the plan no longer active, and
`totalBelowPaid` when a payment banked in between now exceeds the new total.

`class_schedule` enters a whole weekly planning in one transaction, or nothing. `periodId` comes
from `list_periods`; each line of `slots` carries `className`, `weekday`, `startTime`, `endTime`,
an optional `description` and `teacherNames` — labels, resolved by the preview against the classes
of that period and the teachers assigned to each class, in either name order, by first name or by
last name. Up to one hundred lines. The plan lists each slot with its resolved class and teachers,
and `matches` returns the candidates of an ambiguous label and the existing slots in conflict. Its
blockers name the line: `slots.3.className`, `slots.3.teacherNames.0`, `slots.3.startTime`.

| Reason | Cause |
|---|---|
| `notFound` | on `periodId`, an unknown period; on a class label, no class of the period; on a teacher label, no teacher of the school |
| `ambiguousClass` / `ambiguousTeacher` | the label resolves to several; `matches` lists them |
| `teacherNotAssigned` | the teacher exists in the school but is not assigned to that class |
| `invalidTimeRange` | the slot ends before it starts |
| `duplicateSlot` | an earlier line of the batch (`slots.1`) already holds that class, day and times |
| `alreadyExists` | a slot of the period already holds that class, day and times; its `id` is the value |
| `classOverlap` | the slot overlaps an earlier line or an existing slot of the same class |
| `teacherOverlap` | a teacher is booked twice, in the batch or anywhere else in the school; a warning unless the school forbids it |

The commit rereads the classes and their teacher assignments, takes every class and teacher lock
of the batch at once, then writes the slots one by one with the dashboard's overlap checks — a slot
written earlier in the batch is seen by the next one. The first refusal rolls the whole planning
back; the result lists each written `id` with its teacher-overlap warnings, and a replay returns it
unchanged.

`record_teacher_expense` needs `teacher_expenses_enabled` on the school: otherwise both tools return
`notConfigured`, and a draft prepared before the switch is refused at commit without being claimed.
The teacher comes as `teacherName` — first name, last name or both, in either order, as written on
the receipt — or as `teacherId` from `list_teachers`, never both. `amount` is a positive decimal in
the school's currency with at most two decimals; `category` and `description` are free text (100 and
250 characters). `requestedAt` and `paidAt` are calendar days (`2026-09-12`), stored at midnight UTC
like the dashboard form; `requestedAt` defaults to today. The plan shows the resolved teacher, the
amount, both dates and the texts.

| Finding | Kind | Cause |
|---|---|---|
| `notFound` | blocker | no active teacher of the school matches the name or the id |
| `ambiguousTeacher` | blocker | the name matches several teachers; `matches.teachers` lists them |
| `possibleDuplicateExpense` | warning | an active note of the same teacher, amount and day exists; its `id` is the value |
| `paidBeforeRequested` | warning | `paidAt` is before `requestedAt`, which the dashboard accepts too |

The commit rereads the teacher in its transaction (`notFound` when archived since the preview) and
creates the note; the result is `id`, `teacherId`, `amount`, `requestedAt`, `paidAt`, and a replay
returns it without a second note.

A commit that refuses leaves the draft intact and unlocked: fix what the body names, or run the
preview again, and no partial row was written.

The two pairs chain: `enroll_family` creates enrollments as `PENDING`, and `record_payment` pays
`PENDING` and `ACTIVE` ones alike, so a family just enrolled can record its next payment right away.
A family owes one balance across its children and may settle it in several payments.

`preview_record_payment` defaults what a receipt often omits: the whole remaining balance
(`nothingDue` when there is none), `CASH`, today. The family may be named by `studentId`.

`cancel_payments` (`paymentIds`) is a direct write, not a pair: it deactivates active manual payments
of one family, under the family payment lock. Refusals: `notFound`, `onlinePayment` (Stripe),
`mixedFamilies`.

## The dashboard assistant shares the tools and the drafts

The dashboard's AI assistant (`POST /api/ai/assistant`, `docs/ai-assistant.md`) calls every tool of
this server, from the shared catalog `src/mcp/school-tools.ts` that `buildMcpServer` also iterates.
A tool added there is exposed on both surfaces; on the assistant side, each write tool waits for the
administrator's explicit approval in the panel before it runs.

Its drafts carry `ownerKind: ADMIN_SESSION` and the administrator's `userId`; a key's carry
`ownerKind: MCP_KEY` and the `keyId`; a ChatGPT connection's carry `ownerKind: OAUTH_GRANT` and the
`grantId`. A draft never crosses over: one prepared by a key is `draftNotFound` for the
administrator's session or for a connection, and the reverse, even for the same person and the same
school.
