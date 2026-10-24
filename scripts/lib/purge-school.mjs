/**
 * Deletes the business data of ONE school, before `migrate-legacy.mjs` re-imports it.
 *
 * Every deletion is filtered by `schoolId`. Without that filter, running the migration
 * for one school against an already multi-school database would erase every other
 * school — silently, and for good, since the cleanup transaction commits before the
 * first insertion.
 *
 * The order is the one of `prisma/seed.ts`, restricted to the school: foreign keys
 * first. `Config` is deliberately absent — the script re-imports no configuration, so
 * purging it would wipe the school's theme and logos with nothing to put back.
 * `School`, `SchoolMember` and `User` are absent too: the script imports into an
 * existing school and creates no account.
 *
 * The list is WIDER than what `migrate-legacy.mjs` re-inserts, and that difference is
 * destructive. Its twelve INSERTs do not cover `UserFamily`, `Invitation`,
 * `PaymentTransaction` or `PaymentProviderEvent`; those are purged because they hold
 * foreign keys that would otherwise block the deletion, and nothing puts them back. A
 * school that already has data loses its parent-to-family links, its outstanding
 * invitations and its payment transactions, permanently. Accounts and their
 * `SchoolMember` rows survive; what tied a parent to a family does not.
 */
export const SCHOOL_PURGE_TABLES = [
  'Payment',
  'PaymentTransaction',
  'Invitation',
  'ClassAssignment',
  'Enrollment',
  'Plan',
  'ClassPeriod',
  'LevelProgression',
  'Level',
  'Period',
  'PhoneNumber',
  'Student',
  'FamilyPerson',
  'Person',
  'UserFamily',
  'Family',
]

/**
 * `PaymentProviderEvent` carries no `schoolId`: it is a platform log whose transaction
 * is nullable. It is deleted by joining its transactions, which leaves orphan events
 * alone since they belong to no school.
 */
const DELETE_PROVIDER_EVENTS = `
  DELETE FROM "PaymentProviderEvent" AS e
  USING "PaymentTransaction" AS t
  WHERE e."paymentTransactionId" = t.id AND t."schoolId" = $1
`

/**
 * Runs the purge on the given `pg` client. The transaction belongs to the caller: a
 * failure part-way through must roll the whole cleanup back.
 */
export async function purgeSchool(client, schoolId) {
  if (!schoolId) {
    throw new Error('purgeSchool requires a schoolId')
  }

  await client.query(DELETE_PROVIDER_EVENTS, [schoolId])

  // `LevelProgression` cascades from `Level`, yet it is purged first like every other
  // child table: its edges are intra-school since both foreign keys include `schoolId`.
  for (const table of SCHOOL_PURGE_TABLES) {
    await client.query(`DELETE FROM "${table}" WHERE "schoolId" = $1`, [schoolId])
  }
}
