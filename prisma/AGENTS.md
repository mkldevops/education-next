# Prisma and PostgreSQL

This directory owns the PostgreSQL schema, versioned migrations, and destructive local fixtures.

## Schema and Generated Client

`schema.prisma` is canonical. Prisma 7 generates the client into `src/generated/prisma`; never edit
generated files or import the application client from `@prisma/client`.

```typescript
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaClient as PrismaClientBase } from '@/generated/prisma/client'
```

Runtime client construction uses `@prisma/adapter-pg` in `src/lib/db.ts`. Application code imports the
shared `db` singleton.

## Schema Changes and Migrations

Every shared schema change needs a reviewed migration:

```bash
pnpm db:migrate
pnpm db:generate
```

Commit both the schema and migration. `pnpm build:prod` is the available command that includes
`prisma migrate deploy`, but the tracked Docker build does not invoke it; deployments must run
migrations separately. Never use `db push` for production or shared environments. The current schema,
not historical migrations, defines active models—`Page` was removed by the July 2026 migration.

## Soft Deletion and Relations

Models with `isActive` are deactivated with updates rather than hard-deleted. Normal application reads
are also filtered by the extension in `src/lib/db.ts`. Preserve the schema's existing UUID/CUID choice
for each model, and validate inputs against the correct identifier format.

When adding a relation, specify intentional delete behavior and add indexes for foreign keys and
frequently filtered fields.

## Seed Safety

`seed.ts` deletes existing data before recreating fixtures. Run `pnpm db:seed` only against a
disposable local database, never production or a shared environment.
