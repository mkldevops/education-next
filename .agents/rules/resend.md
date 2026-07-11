---
paths:
  - ".env.example"
  - "src/config/email.ts"
  - "src/lib/email.ts"
  - "src/gateways/email/**"
  - "src/types/email.ts"
  - "src/lib/auth.ts"
---

# Email and Resend Rules

Scope: .env.example, src/config/email.ts, src/lib/email.ts, src/gateways/email/**,
  src/types/email.ts, src/lib/auth.ts

## Proactive Behavior

Send application email through `sendEmail()` or `sendEmailBatch()` from `@/lib/email`. Never construct
a Resend client in a Server Action, use case, or auth callback.

## Provider Boundary

`src/lib/email.ts` lazily creates the provider from `src/config/email.ts`; the concrete Resend adapter
lives in `src/gateways/email/resend-provider.ts`. New providers must implement `EmailProvider` and be
wired in the factory rather than selected at call sites.

Required configuration is `EMAIL_PROVIDER`, `EMAIL_FROM`, `ADMIN_EMAIL`, and the provider-specific API
key; `EMAIL_FROM_NAME` is optional. Do not log secret values or include them in client bundles.

The current factory constructs `ResendProvider`; do not claim Brevo or Mailpit delivery works merely
because an environment value or Compose service exists. A provider addition must include its adapter,
factory branch, configuration validation, and tests.

## Results

Provider errors map to the typed `SendEmailResult` discriminants. Preserve that abstraction and do not
return raw Resend responses or exception messages to callers.
