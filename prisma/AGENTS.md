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

Commit both the schema and migration. The Docker image starts with `pnpm start:prod`, which runs
`prisma migrate deploy` before `next start`, so a merged migration applies on the next deploy.
`pnpm build:prod` runs the same deploy step at build time. Never use `db push` for production or
shared environments. The current schema, not historical migrations, defines active models.

`0_init` is the generated baseline: replaying `prisma/migrations/` from an empty database reproduces
`schema.prisma` exactly. A database created with `db push` before that baseline existed must be
adopted once with `prisma migrate resolve --applied`; the procedure and its failure modes are in
`prisma/migrations/0_init/README.md`. Verify any replay or adoption with:

```bash
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

## Soft Deletion and Relations

Models with `isActive` are deactivated with updates rather than hard-deleted. Normal application reads
are also filtered by the extension in `src/lib/db.ts`. Preserve the schema's existing UUID/CUID choice
for each model, and validate inputs against the correct identifier format.

When adding a relation, specify intentional delete behavior and add indexes for foreign keys and
frequently filtered fields.

## Seed Safety

`seed.ts` deletes existing data before recreating fixtures. Run `pnpm db:seed` only against a
disposable local database, never production or a shared environment.
