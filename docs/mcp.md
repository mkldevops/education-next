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

After a key is created, the tab offers four clients. Every snippet is built from the site the page is
served from: the URL is `<origin>/api/mcp`, and the server name carries the host —
`education-ecole-example-fr` for `https://ecole.example.fr` — so two deployments configured on the
same machine stay distinct. The key appears only in the Claude Code command and the Codex variable,
and disappears with the panel on reload or revocation.

| Client | Status | Route |
|---|---|---|
| Claude Code | available with a key | local command |
| Codex (CLI, IDE extension, desktop app) | available with a key | `~/.codex/config.toml` + environment variable |
| Claude Web (claude.ai, Claude Desktop connectors) | request headers (beta, some accounts) or OAuth — not yet offered (#393) | custom connector |
| ChatGPT | requires OAuth — not yet offered (#393) | personal plugin in developer mode |

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
and send the key as `x-api-key`. Without it, the connector authenticates through OAuth only, which
the server does not offer yet (#393). On a Team or Enterprise plan a request header is one credential
shared by the whole organization, so a personal key does not belong there. The tab shows the route
and the URL, never the key inside a command.

ChatGPT registers a personal plugin: **Settings › Security and login › Developer mode**, then
**Plugins › +** with the site's `/api/mcp` URL, under a name that identifies the site. It also
authenticates through OAuth; a pasted key is not a supported route. The account linking and the
connection test are tracked in #393.

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

## Read tools

Every one of them works in the key's school. Only the last three take arguments.

| Tool | Publishes |
|---|---|
| `describe_school` | `id`, `name`, `slug` |
| `list_levels` | `id`, `name`, `nextLevel { id, name }` |
| `list_periods` | `id`, `name`, `startAt`, `endAt` |
| `list_class_periods` | `id`, `name`, `capacity`, `level { id, name }`, `period { id, name }`, `teachers[].teacher { id, firstName, lastName }` |
| `list_plans` | `id`, `name`, `amount` (decimal string, not cents) |
| `list_teachers` | `id`, `firstName`, `lastName` |
| `find_students` (`query`, `limit?`) | `id`, `name`, `lastname`, `families[] { id, name }`, open `enrollments[]` with `plan` and `classes` |
| `get_family_payments` (`familyId`) | `family`, `remainingBalance`, per-enrollment balances, and the 20 latest active payments with `id`, `amount`, `method`, `paidAt`, `online` (money tools only) |

They are the resolution layer: a label read on paper — "CE1 / 2026-2027", the name of a plan —
becomes an identifier through these lists, before any write is attempted. That is also why the
columns above are the whole of it: a teacher's `email` and `phone` are never published, because
resolving a paper form needs an identity, not a way to contact anyone. Every column is named in
`src/gateways/mcp-read-gateway.ts`, so widening the surface is an edit to that file, not a
side effect of a schema change.

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

Its drafts carry `ownerKind: ADMIN_SESSION` and the administrator's `userId`; yours carry
`ownerKind: MCP_KEY` and your `keyId`. A draft never crosses over: one prepared by a key is
`draftNotFound` for the administrator's session, and the reverse, even for the same person and the
same school.
