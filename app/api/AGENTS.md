# API Routes

These route handlers are independent HTTP security boundaries. The `proxy.ts` matcher excludes
`/api`, so every endpoint owns its validation and access-control behavior.

## Better Auth Handler

Keep `auth/[...all]/route.ts` as the thin adapter around the canonical server auth instance:

```typescript
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

Do not duplicate Better Auth configuration in the route.

## Public Passkey Authentication

`passkey/authenticate/route.ts` is intentionally public. Preserve its boundary order:

1. Rate-limit before expensive authentication work.
2. Parse JSON defensively and validate it with Zod.
3. Verify the stored challenge and require an active user.
4. Create the session, then set the HTTP-only Better Auth cookie.
5. Return stable JSON error keys with appropriate status codes.

Catch unexpected failures without exposing implementation details. Public passkey authentication is
not a precedent for making user-data endpoints unauthenticated.

## Runtime

Keep auth and database routes on the default Node.js runtime. Better Auth, `@prisma/adapter-pg`,
`node:crypto`, and `Buffer` are not compatible with an Edge-only route.
