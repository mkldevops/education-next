# Enrollment assistant (OpenRouter)

`/dashboard/enroll-assistant` lets a school administrator turn a photographed enrollment sheet,
or a pasted text, into a family enrollment through a chat backed by a vision model on OpenRouter.
The model proposes; the administrator corrects; the server previews and, on an explicit *Confirm*,
writes. The business rules and their reasons are in `docs/business-rules.md`, section *Enrollment
assistant (OpenRouter)*; this page is the operator's side.

## Prerequisites

1. `SETTINGS_ENCRYPTION_KEY` in the environment: 32 bytes, hex (64 characters) or base64.
   `openssl rand -hex 32` produces one. It encrypts the OpenRouter key at rest; without it the
   key form refuses to save. Rotating it makes the stored key `unreadable`: enter the key again.
2. An OpenRouter API key with access to the chosen model.
3. Optionally `AI_ASSISTANT_MODEL`, one of `AI_ASSISTANT_MODELS` in `src/domain/ai-assistant.ts`.
   Any other value falls back to the default, `google/gemini-2.5-flash`.

## Opening the assistant

Both steps are in **Configuration → Integrations**, visible to a super-admin only.

1. **OpenRouter key**: enter or replace the key. The page only ever shows *configured*,
   *not configured* or *unreadable*; the value is never displayed again, nor sent to the browser.
   *Delete* removes the row.
2. **Enrollment assistant** toggle: off by default. While off, the sidebar entry is hidden, the page
   is a 404, and the chat, preview and confirm calls all refuse — including a preview prepared before
   the toggle was cut. Turning it off keeps the key.

A school administrator (`ADMIN` in the active school, or a super-admin) then sees *Enrollment
assistant* in the sidebar. A parent or a teacher never does, and the routes refuse them.

## Using it

- Write what you know, or attach photos of the sheet: PNG, JPEG or WebP, up to 4 per message and 8
  per conversation, 6 MiB each. The panel states, before the first send, that photos are sent to
  OpenRouter and names the model. Photos are re-encoded in memory (rotation applied, metadata
  stripped, longest side capped) and are never stored.
- The model fills the form on the right and lists what it could not read (*missing*, *illegible*,
  *ambiguous*). It does not invent a name, a date, a class, a plan or a payment. Every field is
  editable; siblings may sit in different classes and on different plans.
- **Preview** resolves the form against the school: the class and the plan each label maps to, the
  amount per child, the split of a payment, and namesake families or students. Attaching to an
  existing family is done by choosing one among the matches; the model never does it.
- **Confirm** appears on a valid preview and engages exactly that preview. Editing any field hides
  it until a new preview. The preview is valid for 30 minutes.
- Switching school clears the conversation, the photos and the preview.

## Refusals seen in the UI

| Message | Cause |
|---|---|
| assistant disabled / not configured | toggle off, or no readable key |
| forbidden file / image too large / unreadable image | outside PNG, JPEG, WebP; above 6 MiB; not decodable |
| too many photos / too many messages / message too long | conversation limits |
| too many requests | 20 requests per minute per administrator and school |
| invalid key / quota exceeded / provider rate limited / timeout / provider error | OpenRouter answer; details in the server log only |
| unusable proposal | the model's tool call does not match the proposal schema; the form is left as it was |
| expired / checksum mismatch / class full / duplicate enrollment / commit in progress | the commit re-checks, see *Write drafts* in the business rules |

## Relation to the MCP

The assistant reuses `previewEnrollFamily` and `commitEnrollFamily` directly, with a draft owned by
the administrator's session (`ownerKind: ADMIN_SESSION`). MCP drafts are owned by their key and stay
isolated: neither side can present the other's draft. `docs/mcp.md` covers the key-based access.

## Choosing the model

The allowlist holds models known to read an image and call a tool. Which one reads real sheets
best has not been settled on real forms; validate on a small set of anonymized sheets before
freezing `AI_ASSISTANT_MODEL` for an instance.
