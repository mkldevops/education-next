# READ BEFORE APPLYING — this migration carries data

This is the first migration in this repository that **moves data** rather than only changing shape.
It back-fills `Family."emergencyContact"` into `emergencyContactName` + `emergencyContactPhone`, and
only then drops the old column. Applying the schema change without the back-fill destroys every
emergency contact on record — the field staff read when a child is injured.

## `prisma db push` MUST NOT be used to apply this

`prisma db push` (`pnpm db:push`, `package.json`) diffs `schema.prisma` against the live database and
issues the difference directly. For this change that is:

```sql
ALTER TABLE "Family" DROP COLUMN "emergencyContact";
ALTER TABLE "Family" ADD COLUMN "emergencyContactName" VARCHAR(250);
ALTER TABLE "Family" ADD COLUMN "emergencyContactPhone" VARCHAR(20);
```

The back-fill in `migration.sql` never runs. Both new columns end up empty and the source data is
gone. There is no recovery short of a database restore.

## Why this is a real risk here, not a theoretical one

The checked-in migration history has **no baseline**: no migration creates `"User"` or `"Family"`,
yet `20260321000000_add_passkey_table` already adds a foreign key to `"User"`. On a database whose
`_prisma_migrations` table is empty — which is the case for the local Docker database, built with
`db:push` — `prisma migrate deploy` replays from migration #1 and aborts before ever reaching this
one. That failure makes `db push` the tempting fallback, which is exactly the destructive path.

Tracked as **#203**. Until that is fixed, applying this migration requires a deliberate choice below.

## Applying it correctly — pick one

**(a) Let `migrate deploy` reach this migration.** On the target database, mark the six prior
migrations as already applied, then deploy:

```bash
prisma migrate resolve --applied 20260321000000_add_passkey_table
prisma migrate resolve --applied 20260321100000_add_invitation_table
prisma migrate resolve --applied 20260321110000_add_color_config_type
prisma migrate resolve --applied 20260411000000_add_page_model
prisma migrate resolve --applied 20260711000000_drop_page_model
prisma migrate resolve --applied 20260731120000_family_payments_and_invitations

prisma migrate deploy
```

`migrate resolve` only writes to `_prisma_migrations`; it does not touch table data. Verify each name
matches a directory in `prisma/migrations/` before running it.

**(b) Run this migration's SQL manually**, before any schema sync, then record it as applied:

```bash
psql "$DATABASE_URL" -1 -f prisma/migrations/20260806090000_split_family_emergency_contact/migration.sql
prisma migrate resolve --applied 20260806090000_split_family_emergency_contact
```

The `-1` matters: it wraps the file in a single transaction, so a failed back-fill rolls back the
column drop instead of leaving the table half-migrated.

## This SQL is not idempotent — run it exactly once

Re-running it raises:

```
Family."emergencyContact" is already missing: this migration carries data and must run
exactly once, before any schema sync.
```

That guard is deliberate. It fires when the source column has already gone — whether from a previous
successful run or from a `db push` that destroyed the data — so a half-applied state is loud instead
of silently producing two empty columns.

## Back-fill behaviour

Values are split conservatively. When the split is ambiguous the **entire original string** is kept
as the name rather than split badly: an unstructured value is still fixable by an admin, a mangled
name paired with an unusable number is not. A candidate name must contain a letter, so a value
holding only numbers (`"0611223344 / 0698765432"`) is kept whole instead of filing one of the numbers
as somebody's name.

| Original | Name | Phone |
|---|---|---|
| `Fahari` | `Fahari` | — |
| `06 12 34 56 78` | — | `06 12 34 56 78` |
| `Marie QA2 - 06 11 22 33 44` | `Marie QA2` | `06 11 22 33 44` |
| `06 11 22 33 44 Marie` | `Marie` | `06 11 22 33 44` |
| `Marie QA2 06 11 22 33 44` | *(kept whole)* | — |
| `0611223344 / 0698765432` | *(kept whole)* | — |

The same rules are implemented in JavaScript in `scripts/lib/emergency-contact.mjs` for the legacy
MySQL import, and both are exercised against one shared fixture table. Keep them in step.
