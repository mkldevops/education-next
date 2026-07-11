# Shared Runtime and Utilities

This directory contains runtime singletons, authentication clients, email access, branding helpers,
and small pure utilities.

## Server and Client Boundaries

Server-only modules include `auth.ts`, `db.ts`, `email.ts`, and DB-backed `branding.ts`. Never import
them into a `'use client'` module. Client authentication uses the named exports from
`auth-client.ts`:

```typescript
import { signIn, signOut, useSession } from '@/lib/auth-client'
```

Server code imports `auth` and forwards the current request headers:

```typescript
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

const session = await auth.api.getSession({ headers: await headers() })
```

## Database Client

Use the exported `db` singleton from `@/lib/db`; never instantiate another application Prisma
client. It lazily creates a `PrismaPg` client and stores the extended instance on `globalThis`.

Reads on models listed in `modelsWithIsActive` automatically receive `isActive: true`. This filter
overrides a caller-supplied inactive value, so code that intentionally needs inactive records cannot
use the normal extended read path.

## Environment Handling

There is no centralized startup environment schema. Database configuration fails lazily when
`DATABASE_URL` is first needed, and `src/config/email.ts` validates email variables when the provider
is created. Auth and public app URLs currently have localhost fallbacks.

Do not claim an environment variable is validated globally unless the implementation changes. Keep
pure helpers free of database, network, and server-only imports so they remain usable in Client
Components and tests.
