# MCP server

`POST /api/mcp` exposes this application to an agent — Claude Code, Claude Desktop, Codex — over the
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

1. A super-admin enables **MCP** on `/dashboard/integrations`. The platform flag `mcp_enabled` is
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

Claude Code, one command — the tab prints it prefilled after a key is created:

```bash
claude mcp add --transport http education https://your-instance.example/api/mcp \
  --header "Authorization: Bearer edu_mcp_…"
```

Codex, or any client reading a JSON configuration:

```json
{
  "mcpServers": {
    "education": {
      "type": "http",
      "url": "https://your-instance.example/api/mcp",
      "headers": { "Authorization": "Bearer edu_mcp_…" }
    }
  }
}
```

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

Every one of them works in the key's school and takes no arguments.

| Tool | Returns |
|---|---|
| `describe_school` | the school the key opens |
| `list_levels` | active levels, with their next level when defined |
| `list_periods` | active school years, most recent first |
| `list_class_periods` | active classes with capacity, level and period |
| `list_plans` | active pricing plans and their amount, in cents |
| `list_teachers` | active teachers |

They are the resolution layer: a label read on paper — "CE1 / 2026-2027", the name of a plan —
becomes an identifier through these lists, before any write is attempted.

## Writing: the preview/commit pairs

Two pairs are shipped. `create_teacher` and `record_teacher_expense` are not — a teacher sheet and a
teacher expense note still go through the dashboard.

| Tool | Paper it matches | State |
|---|---|---|
| `enroll_family` | a full enrollment form: family, parents, students, enrollment, deposit | shipped |
| `record_payment` | a receipt or payment slip | shipped |
| `create_teacher` | a teacher sheet | not shipped |
| `record_teacher_expense` | a teacher expense note | not shipped |

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

`commit_*` sends back the `draftId` and that checksum, not the payload: a model does not
re-serialize two kilobytes byte for byte. The checksum proves the resolved plan was read; a
single-pass lock makes a replay after a network cut return the recorded result instead of a second
family. A draft lives thirty minutes.

A draft belongs to the API key that proposed it. Another key of the same school — even one held by
the same person — is told the draft does not exist, because the plan carries the proposing key's
user as the author of everything it creates.

The result is written inside the same transaction as the data, so a draft that is `COMMITTED` with
no result wrote nothing. That is the exit for a commit killed mid-flight: after sixty seconds the
lock is reclaimable, and a commit refused on a business rule gives the lock back immediately.

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
| `notFound` | the class resolved by the preview no longer exists |
| `classFull` | the class filled up between the preview and the commit |
| `overpayment` | the amount now exceeds what the family still owes |
| `noActiveEnrollments` | the family's enrollments are no longer `ACTIVE` |
| `refundExceedsPaid` | the refund now exceeds what was banked |
| `staleDraft` | the split no longer matches the fresh balances; preview again |
| `internalError` | anything unexpected, with the detail kept server-side |

A commit that refuses leaves the draft intact and unlocked: fix what the body names, or run the
preview again, and no partial row was written.

The two pairs do not chain: `enroll_family` creates enrollments as `PENDING`, and `record_payment`
only pays `ACTIVE` ones, so a family just enrolled answers `noActiveEnrollments` until an admin
validates the enrollment from the dashboard. Its deposit still goes through `enroll_family` itself.
