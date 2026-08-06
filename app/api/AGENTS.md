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
3. Delegate to `authenticateWithPasskey`, which verifies the stored challenge, requires an active
   user, and creates the session through `sessionGateway`.
4. Forward the `Set-Cookie` values the gateway returns; never build the session cookie by hand.
5. Return stable JSON error keys with appropriate status codes.

Sessions must come from Better Auth. `src/gateways/session-gateway.ts` calls
`internalAdapter.createSession` and `setSessionCookie` so the cookie name, the `__Secure-` prefix,
the HMAC signature, and the session cookie cache all stay owned by Better Auth. A raw session token
written directly to `better-auth.session_token` is rejected by `auth.api.getSession()`.

Catch unexpected failures without exposing implementation details. Public passkey authentication is
not a precedent for making user-data endpoints unauthenticated.

## Runtime

Keep auth and database routes on the default Node.js runtime. Better Auth, `@prisma/adapter-pg`,
`node:crypto`, and `Buffer` are not compatible with an Edge-only route.
