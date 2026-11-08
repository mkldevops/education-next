---

paths:

- "app/**"
- "src/**"

---

# Hybrid Clean Architecture Rules

Scope: app/**, src/**

## Proactive Behavior

Place new behavior in the layer used by the surrounding feature. Preserve the application's actual
read/write split rather than forcing a stricter architecture that the repository does not use.

## Layer Responsibilities

```text
Dashboard read: Server Component -> scoped db projection
Mutation: Client -> Server Action -> Use Case -> Domain/Gateway
Atomic mutation: Use Case -> db.$transaction when one operation owns the boundary
```

- Pages own route inputs, localization, authorization of reads, and view-specific projections.
- Server Actions own authentication, input boundaries, use-case invocation, and revalidation.
- Use cases own application sequencing and expected business results, not sessions or redirects.
- Domain modules contain pure business rules without I/O.
- Gateways contain reusable persistence or provider access.

## Use-Case Pattern

Validate with the feature schema, apply domain rules, then call gateways:

```typescript
const parsed = createFamilySchema.safeParse(input)
if (!parsed.success) return 'validationError' as const

const result = validateFamilyName(parsed.data.name)
if (result !== 'OK') return result

const { parents, address, postCode, city, ...familyData } = parsed.data
return familyGateway.createWithParents({
  ...familyData,
  createdById: input.createdById,
  parents: parents.map((parent) => ({ ...parent, address, postCode, city })),
})
```

A direct `db.$transaction` is acceptable inside a use case when multiple queries must succeed as one
operation, as in enrollment creation. Do not move request headers, cookies, redirects, or cache
revalidation into use cases or domain modules.
