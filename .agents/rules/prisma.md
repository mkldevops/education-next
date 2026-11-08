---

paths:

- "prisma/**"
- "prisma.config.ts"
- "app/**"
- "src/**"

---

# Prisma Rules

Scope: prisma/**, prisma.config.ts, app/**, src/**

## Proactive Behavior

When changing the Prisma schema, require a reviewed migration and regenerated client. When changing a
query, verify identity/scope filters and the `isActive` extension behavior before executing it.

## Prisma 7 Client

The generator writes to `src/generated/prisma`. Import generated types from
`@/generated/prisma/client` and application access from the shared singleton:

```typescript
import type { PrismaClient } from '@/generated/prisma/client'
import { db } from '@/lib/db'
```

Never instantiate an additional application client or edit files under `src/generated/prisma`.
Runtime construction uses `@prisma/adapter-pg`. Standalone scripts such as `prisma/seed.ts` are the
exception: they may construct a raw adapter-backed client and must disconnect it when finished.

## Migrations

```bash
pnpm db:migrate
pnpm db:generate
```

Commit the schema and migration together. `pnpm db:push` is local prototyping only; shared and
production environments use `prisma migrate deploy`.

## Query Safety and Soft Deletion

Never pass an optional identity or scope into a Prisma filter. Guard it first:

```typescript
if (!userId) return 'unauthorized' as const
return db.passkey.findMany({ where: { userId } })
```

The extension in `src/lib/db.ts` forces `isActive: true` on normal reads for its listed models,
overriding a caller-supplied inactive value. Deactivate those records with updates. Code that must
inspect inactive rows needs an explicit, reviewed access path.

`prisma/seed.ts` deletes existing records. Run it only against disposable local data.
