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

## Tools

Read-only, for now. Every one of them works in the key's school and takes no arguments.

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

**Not shipped yet.** The write tools land in the next two increments, in pairs:

| Tool | Paper it matches |
|---|---|
| `enroll_family` | a full enrollment form: family, parents, students, enrollment, deposit |
| `record_payment` | a receipt or payment slip |
| `create_teacher` | a teacher sheet |
| `record_teacher_expense` | a teacher expense note |

The shape they will follow, and the reason for it:

```text
photo ──▶ agent extracts fields
      ──▶ preview_enroll_family(fields)
            → { draftId, checksum, plan, matches, warnings, blockers }
            → writes nothing
      ──▶ human reads the resolved plan
      ──▶ commit_enroll_family({ draftId, checksum })
            → family, parents, students, enrollment, payment
```

`preview_*` normalizes, validates field by field — an agent must be able to correct its reading,
which an opaque `validationError` does not allow — resolves human labels into identifiers, and
probes for duplicates. It persists a draft and returns a 12-character checksum.

`commit_*` sends back the `draftId` and that checksum, not the payload: a model does not
re-serialize two kilobytes byte for byte. The checksum proves the resolved plan was read; a
single-pass lock makes a replay after a network cut return the recorded result instead of a second
family.

Until then, the six read tools are safe to leave connected: this server cannot write.
