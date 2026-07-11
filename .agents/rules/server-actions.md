# Server Action Rules

Scope: always loaded (security-critical)

## Proactive Behavior

When adding or modifying a server action, verify its authentication category, input validation,
result contract, and cache revalidation before considering it complete.

## Boundary Order

For protected data, establish a non-optional authenticated identity or role before any database or
use-case work. Validate untrusted input before mutation, invoke the existing use case, and revalidate
only after success:

```typescript
const user = await requireAdmin()
if (!user) return 'unauthorized' as const

const result = await activateEnrollment(input)
if (result !== 'OK') return result

revalidatePath('/dashboard/enrollments')
return 'OK' as const
```

## Exports and Location

Every export from a `'use server'` file must be an async function. Move constants, schemas, and sync
helpers to ordinary modules.

Route-owned dashboard actions live in `app/[locale]/(dashboard)/_lib/`. Cross-route profile, passkey,
and preference actions live in `src/actions/` and are exported through `src/actions/index.ts` when
public.

## Result Contracts

There is no universal action return shape. Preserve the contract used by the action family:

- Dashboard mutations commonly return an entity, `'OK'`, or a typed error string.
- Profile actions return `ActionResult<T>` objects.
- Passkey actions use operation-specific objects and string discriminants.

Expected business failures should remain serializable and typed. Do not leak stack traces or raw
provider errors to clients.
