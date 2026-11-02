# AI assistant (OpenRouter)

A chat for school administrators, backed by a model on OpenRouter. It answers questions about the
school and performs the same operations as the MCP — enrollments, payments, enrollment changes,
events, weekly schedule — each write waiting for the administrator's approval. The business rules
and their reasons are in `docs/business-rules.md`, section *AI assistant (OpenRouter)*; this page is
the operator's side.

## Prerequisites

1. `SETTINGS_ENCRYPTION_KEY` in the environment: 32 bytes, hex (64 characters) or base64.
   `openssl rand -hex 32` produces one. It encrypts the OpenRouter key at rest; without it the
   key form refuses to save. Rotating it makes the stored key `unreadable`: enter the key again.
2. An OpenRouter API key with access to the chosen model.
3. Optionally `AI_ASSISTANT_MODEL`, one of `AI_ASSISTANT_MODELS` in `src/domain/ai-assistant.ts`.
   Any other value falls back to the default, `deepseek/deepseek-v4.1-flash`.

## Opening the assistant

Both steps are in **Configuration → Integrations**, visible to a super-admin only.

1. **OpenRouter key**: enter or replace the key. The page only ever shows *configured*,
   *not configured* or *unreadable*; the value is never displayed again, nor sent to the browser.
   *Delete* removes the row.
2. **AI assistant** toggle: off by default. While off, the sidebar entry and the floating button are
   hidden, the page is a 404, and the chat refuses — including an approval given before the toggle
   was cut. Turning it off keeps the key.

A school administrator (`ADMIN` in the active school, or a super-admin) then sees *AI assistant* in
the sidebar and an **Assistant** button on every dashboard page. A parent or a teacher never does,
and the route refuses them.

## Using it

Two entry points, one behavior: the **Assistant** button opens a side panel on any dashboard page,
and `/dashboard/enroll-assistant` shows the chat full-width (the button is hidden there). Both call
`POST /api/ai/assistant` with the MCP's tool catalog (`src/mcp/school-tools.ts`).

- Ask a question or request an action. Reads (school, levels, periods, plans, teachers, schedule,
  events) run on their own.
- Every write (`commit_*`, event creation or change, schedule slot changes) stops on a card showing
  the exact input, and runs only after *Valider*. *Annuler* drops it; the model does not retry.
- Enrollments, payments and enrollment changes go through a preview first: the model summarizes the
  resolved plan, warnings and blockers, then shows the approval card, which repeats that plan. One
  *Valider* is enough; you are never asked to confirm in text. A preview is valid for 30 minutes.
- A payment asks nothing by default: whole remaining balance, cash, today, for the student or family
  of the current page. Say otherwise ("150 € par chèque") to change it.
- A manual payment recorded by mistake can be undone: "annule le dernier paiement de cette famille".
  Online (Stripe) payments cannot.
- Attachments: photos (PNG, JPEG, WebP) and PDF files, up to 4 per message and 8 per conversation,
  6 MiB each. Add them with the paperclip, by pasting from the clipboard (a screenshot becomes
  `capture-<time>.png`) or by dropping them on the panel. The panel states, before the first send,
  that messages and attachments go to OpenRouter and names the model. Photos are re-encoded in memory
  (rotation applied, metadata stripped, longest side capped); PDF files are checked, then sent as is.
  Nothing is stored. The model does not guess an illegible field; it asks.
- *Famille* in the composer picks a family as the conversation's context: the assistant uses it
  directly and never asks which family. It wins over the page. The cross removes it.
- The page you are on is sent as a hint, so "this class" or "these payments" resolve.
- An empty conversation offers a few example requests; a click fills the input without sending.
- The current period is the default: the assistant never asks which one. "Nouvel enseignant
  Prénom Nom" goes straight to the approval card — no class, no email, no phone asked.
- After an approved write, the page refreshes. Enter sends, Shift+Enter adds a line. The cursor
  returns to the input at the end of each answer.
- *Dicter* (Chrome, Edge, Safari; hidden in Firefox) turns speech into text in the input, which you
  still send yourself. The browser's speech service does the recognition — Google's for Chrome — so
  the audio leaves through the browser vendor, never through this application.
  The first click asks for microphone access; if it was refused, allow it from the address bar.
- *Historique* lists your 30 latest conversations in this school, to reopen or delete. They are
  saved on the server without their attachments; nobody else sees them. Switching school starts a new one.

## Refusals seen in the UI

| Message | Cause |
|---|---|
| assistant disabled / not configured | toggle off, or no readable key |
| forbidden file / file too large / unreadable file | outside PNG, JPEG, WebP, PDF; above 6 MiB; not decodable |
| too many attachments / too many messages / message too long | conversation limits |
| too many requests | 20 requests per minute per administrator and school |
| invalid key / quota exceeded / provider rate limited / timeout / provider error | OpenRouter answer; details in the server log only |
| approval unavailable | `BETTER_AUTH_SECRET` missing: writes are refused, reads still work |
| expired / checksum mismatch / class full / duplicate enrollment / commit in progress | the model explains the commit's refusal, see *Write drafts* in the business rules |

## Relation to the MCP

The assistant calls the very tools the MCP registers (`listSchoolTools`), with drafts owned by the
administrator's session (`ownerKind: ADMIN_SESSION`). MCP drafts are owned by their key and stay
isolated: neither side can present the other's draft. Adding a tool to `listSchoolTools` exposes it
on both surfaces. `docs/mcp.md` covers the key-based access.

Canteen and snack tools share this approval boundary. `get_meal_settings`,
`get_student_meals` and `list_family_receipts` read the current school's meal records;
settings, prices, subscriptions, openings, absences and cashier receipts are writes requiring
approval. Meal income uses `record_receipt`, with a stable idempotency key and the coverage
last read from `get_student_meals`; it must never be entered as tuition with `record_payment`.
Historical coverage uses `record_meal_opening` with its source in the reason. Receipts use
today's date and price and cannot reproduce a historical cash payment.

## Choosing the model

The allowlist holds models known to read an image and call a tool. Which one reads real sheets
best has not been settled on real forms; validate on a small set of anonymized sheets before
freezing `AI_ASSISTANT_MODEL` for an instance.
