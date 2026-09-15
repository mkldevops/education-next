# Better Auth and Authorization Rules

Scope: always loaded (security-critical)

## Proactive Behavior

When creating or changing a Server Action, API route, or Server Component that accesses protected
data, verify the session and the required role, ownership, or family scope before the first protected
query. Do not rely on `proxy.ts`; its matcher excludes `/api`, and actions remain callable boundaries.

## Server Authentication

Use the canonical server instance and forward request headers:

```typescript
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

const session = await auth.api.getSession({ headers: await headers() })
if (!session) return 'unauthorized' as const
```

Never allow `session?.user.id` or another optional identity to reach a Prisma `where` clause.

Dashboard operations use `requireSchoolAdmin()`, `requireSchoolSession()`, `requireSchoolScope()`, or
`requirePlatformAdmin()` from `app/[locale]/(dashboard)/_lib/auth-helper.ts`. Parent reads must also
constrain data by the linked `familyId`; resource pages return `notFound()` when the caller is
outside that scope. If a parent has no linked family, deny access before building the query. Never
pass an optional identity or scope into Prisma.

Role assignment is a privileged operation. Use an explicit allowed-role policy—ordinary admin access
must not implicitly authorize creation or promotion of a `SUPER_ADMIN`.

## Client Authentication

`auth` is server-only. Client Components import named operations from `@/lib/auth-client`:

```typescript
import { signIn, signOut, useSession } from '@/lib/auth-client'
```

Do not import `@/lib/auth`, `@/lib/db`, or other server infrastructure into a `'use client'` module.

## Impersonation

`src/lib/impersonation.ts` reimplements the Better Auth admin impersonation routes against
`User.isSuperAdmin`. Do not install the upstream `admin` plugin: it authorizes through a `role`
column this schema deliberately lacks, and would expose user creation, role, ban and hard-delete
routes that bypass the invitation, role and soft-deletion rules.

## Intentional Public Flows

Invitation acceptance and the passkey authentication option/verification stages are intentionally
public. Preserve the validation and error handling each flow implements. For passkey authentication,
keep challenge verification and the route handler's rate limiter intact. Do not generalize those
exceptions to endpoints that read or mutate user data.
