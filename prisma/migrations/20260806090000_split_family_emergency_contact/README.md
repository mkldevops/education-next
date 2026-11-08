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

## Why this was a real risk, not a theoretical one

The history had **no baseline**: no migration created `"User"` or `"Family"`, yet
`20260321000000_add_passkey_table` already added a foreign key to `"User"`. `prisma migrate deploy`
replayed from migration #1 and aborted before ever reaching this one, which made `db push` the
tempting fallback — exactly the destructive path.

Fixed by the `0_init` baseline (#203). A fresh database now replays the whole history, this
migration included.

## Applying it correctly — pick one

**(a) Let `migrate deploy` reach this migration.** On a database created before the baseline
existed, mark the migrations it already reflects as applied, then deploy. Full procedure and the
exact list in [`../0_init/README.md`](../0_init/README.md):

```bash
prisma migrate status   # confirm where the database actually stands
# prisma migrate resolve --applied <each migration up to 20260731120000>
prisma migrate deploy
```

`migrate resolve` only writes to `_prisma_migrations`; it does not touch table data. Never resolve
this migration as applied on a database that still holds `Family."emergencyContact"` — that discards
the back-fill for good.

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

| Original                     | Name           | Phone            |
| ---------------------------- | -------------- | ---------------- |
| `Fahari`                     | `Fahari`       | —                |
| `06 12 34 56 78`             | —              | `06 12 34 56 78` |
| `Marie QA2 - 06 11 22 33 44` | `Marie QA2`    | `06 11 22 33 44` |
| `06 11 22 33 44 Marie`       | `Marie`        | `06 11 22 33 44` |
| `Marie QA2 06 11 22 33 44`   | _(kept whole)_ | —                |
| `0611223344 / 0698765432`    | _(kept whole)_ | —                |

The same rules are implemented in JavaScript in `scripts/lib/emergency-contact.mjs` for the legacy
MySQL import, and both are exercised against one shared fixture table. Keep them in step.
