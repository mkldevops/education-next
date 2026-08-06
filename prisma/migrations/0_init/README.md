# Baseline migration

This migration creates the schema as it stood **before** the first migration committed to this
repository (`20260321000000_add_passkey_table`). Until it existed, no migration created `"User"` or
`"Family"`, so `prisma migrate deploy` failed on the first foreign key against a table nothing had
created — `migrate deploy` was unusable on an empty database, and `db push` became the fallback
that silently skips the SQL of data-carrying migrations.

It is generated, not hand-written: `schema.prisma` with every later migration reverse-applied, fed
to `prisma migrate diff --from-empty`. Replaying `prisma/migrations/` from an empty database now
reproduces `schema.prisma` exactly.

## Fresh database

Nothing special:

```bash
prisma migrate deploy
```

## Database already in service

A database created with `db push` has an empty or absent `_prisma_migrations` table, so
`migrate deploy` would replay from `0_init` and fail on objects that already exist. Mark everything
already reflected in that database as applied, then deploy the rest.

Check what the database already has before choosing where to stop:

```bash
prisma migrate status
```

`migrate resolve` only writes to `_prisma_migrations`; it never touches table data.

**A database at the current schema** — every migration below is already reflected:

```bash
for m in 0_init \
  20260321000000_add_passkey_table \
  20260321100000_add_invitation_table \
  20260321110000_add_color_config_type \
  20260411000000_add_page_model \
  20260711000000_drop_page_model \
  20260731120000_family_payments_and_invitations \
  20260806090000_split_family_emergency_contact; do
  prisma migrate resolve --applied "$m"
done
```

**A database still holding `Family."emergencyContact"`** — resolve up to the previous migration and
let `deploy` run the data-carrying one, which back-fills before dropping the column:

```bash
for m in 0_init \
  20260321000000_add_passkey_table \
  20260321100000_add_invitation_table \
  20260321110000_add_color_config_type \
  20260411000000_add_page_model \
  20260711000000_drop_page_model \
  20260731120000_family_payments_and_invitations; do
  prisma migrate resolve --applied "$m"
done

prisma migrate deploy
```

Resolving a migration the database does **not** actually reflect leaves a permanent, invisible
drift: Prisma will never apply that SQL again. Verify against a dump or a clone first.

## Verifying

Both paths above were validated on throwaway databases, the second one on a clone of the local
development database. After either, this must report no difference:

```bash
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```
