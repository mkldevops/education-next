# Use Cases

Use cases implement application operations between authenticated boundaries, domain rules, and
infrastructure access.

## Operation Flow

Infer input types from the feature schema, validate with `safeParse`, apply domain rules, then use the
relevant gateway:

```typescript
const parsed = createFamilySchema.safeParse(input)
if (!parsed.success) return 'validationError' as const

const nameCheck = validateFamilyName(parsed.data.name)
if (nameCheck !== 'OK') return nameCheck

const { parents, address, postCode, city, ...familyData } = parsed.data
return familyGateway.createWithParents({
  ...familyData,
  createdById: input.createdById,
  parents: parents.map((parent) => ({ ...parent, address, postCode, city })),
})
```

Expected validation and business failures use typed string discriminants. Use cases do not read
sessions; the caller must authenticate, authorize, and pass non-optional identity or scope.

## Gateways and Transactions

Use gateways for normal persistence operations. A use case may own `db.$transaction` when one
application operation requires an atomic boundary across queries. `enrollments/create-enrollment.ts`
is the reference: it performs the capacity check and enrollment/class assignment writes in one
transaction.

Do not move framework concerns such as request headers, redirects, cookies, or path revalidation into
this layer.

## Tests

Keep use-case tests adjacent as `*.test.ts`. Most tests mock gateway or `db` modules before dynamically
importing the use case. Interface-based profile use cases instead inject hand-written gateway spies.
Match the existing style in the directory being changed and test every new business result.
