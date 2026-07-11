# Dashboard Routes

This route group contains localized, protected dashboard pages, route-owned components, and
dashboard mutation boundaries.

## Request Lifecycle

Data-backed pages render at request time, await route inputs, set the locale, and translate on the
server:

```typescript
await connection()
const { locale, id } = await params
setRequestLocale(locale)
const t = await getTranslations('dashboard.pages.familyDetails')
```

Keep pages as Server Components where possible. Interactive route-only UI belongs in the nearest
`_components/` directory and uses `'use client'` only when hooks or browser APIs require it.

## Authorization and Data Scope

Do not rely on `proxy.ts` or the layout as the only authorization layer. Use `_lib/auth-helper.ts`
before protected reads, then constrain the query to the caller's role and family:

```typescript
const { role, familyId } = await getSessionWithRole()
const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

if (!isAdmin && familyId !== id) notFound()
```

Parents may access only their linked family data. Use `notFound()` for an inaccessible resource to
avoid disclosure; use `forbidden()` when an authenticated role is explicitly denied an operation. If
a parent has no `familyId`, deny access before building any query. Prisma treats `undefined` as an
omitted filter, so an optional family scope must never reach `where`.

## Reads and Mutations

Server pages may use `db` directly for view-specific projections. Mutations belong in `_lib/`, guard
before use-case or database work, preserve the use case's discriminated result, and revalidate only
after success:

```typescript
const user = await requireAdmin()
if (!user) return 'unauthorized' as const

const result = await activateEnrollment(data)
if (result !== 'OK') return result
revalidatePath('/dashboard/enrollments')
return 'OK' as const
```

`invitation-actions.ts` currently performs only a session check; do not copy it as the authorization
pattern for new admin mutations. `user-actions.ts:createUserAction` also accepts every role after only
`requireAdmin()`, so do not use it as the policy for privileged role creation. Role provisioning must
apply an explicit policy such as `requireRole(['SUPER_ADMIN'])`. Choose guards from the operation's
actual authorization requirements.
