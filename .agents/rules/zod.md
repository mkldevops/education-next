---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Zod Rules

Scope: **/*.ts, **/*.tsx

## Proactive Behavior

Use the feature's existing Zod schema for untrusted form, action, and route input. Return the stable
feature error discriminant on validation failure rather than leaking raw validation details.

## Zod 4 Conventions

Prefer Zod 4 top-level format validators:

```typescript
const schema = z.object({
  id: z.uuid(),
  email: z.email(),
})
```

Use `safeParse()` at boundaries and operate on `parsed.data` only after success:

```typescript
const parsed = createFamilySchema.safeParse(input)
if (!parsed.success) return 'validationError' as const
```

For fixed domain values, reuse the existing enum or const source rather than maintaining a second
list of raw strings. Inspect the surrounding schema before changing defaults or optionality; Zod 4
`default()` short-circuits parsing, while `prefault()` preserves parse-time behavior.

## Schema Ownership

Feature schemas live beside their use cases or boundary code. Infer TypeScript input types with
`z.infer` instead of duplicating interfaces, and keep presentation-only error translation in the UI.
