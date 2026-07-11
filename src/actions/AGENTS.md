# Shared Server Actions

This directory contains cross-route actions for profiles, passkeys, and request preferences.
Dashboard-specific mutations stay in `app/[locale]/(dashboard)/_lib/`.

## Authentication Categories

- Profile actions derive the user from Better Auth headers before any user-scoped database work.
- Passkey registration, listing, and deletion require a session. Authentication option generation and
  challenge verification are intentionally public stages.
- Passkey deletion must constrain the lookup by both passkey ID and the authenticated user ID.
- Period preference actions validate the period ID and write only the selected-period cookie.

The standard server session pattern is:

```typescript
const session = await auth.api.getSession({ headers: await headers() })
if (!session) return 'unauthorized' as const
```

## Validation and Results

Validate untrusted data before mutation, and never let an optional identity reach a Prisma filter.
Preserve each action family's existing contract:

- `profile-actions.ts` uses `ActionResult<T>` objects.
- `passkey-actions.ts` returns string discriminants or operation-specific data objects.
- `period-actions.ts` returns `'OK'` or `'invalidPeriodId'`.

Do not introduce a fictional universal action response. All exports from a `'use server'` file must
remain async functions; move constants and synchronous helpers elsewhere.

## Public Exports

Add cross-feature action exports to `src/actions/index.ts`. Keep feature-specific helpers private to
their action file unless another route genuinely consumes them.
