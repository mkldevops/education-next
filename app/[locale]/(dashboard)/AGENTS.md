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
before protected reads, then constrain the query to the caller's scope. `requireSchoolScope()` returns
an admin scope or a parent scope with a non-optional `familyId`, and calls `notFound()` otherwise:

```typescript
const scope = await requireSchoolScope()
if (!scope.isAdmin && scope.familyId !== id) notFound()
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
const { schoolId } = await requireSchoolAdmin()

const result = await activateEnrollment({ ...data, schoolId })
if (result !== 'OK') return result
revalidatePath('/dashboard/enrollments')
return 'OK' as const
```

Guards redirect to login or call `notFound()` instead of returning `null`. School-level mutations use
`requireSchoolAdmin()`; platform-level user mutations (`updateUserAction`, `deleteUserAction`,
`changePlatformLevelAction`…) use `requirePlatformAdmin()`. Role provisioning must apply an explicit
policy: `createUserAction` accepts only a `SchoolRole`, and platform level (`isSuperAdmin`) changes go
through `changePlatformLevelAction`. Choose guards from the operation's actual authorization
requirements.
