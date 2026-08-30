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
 * existing school and touches no account.
 */
export const SCHOOL_PURGE_TABLES = [
  'Payment',
  'PaymentTransaction',
  'Invitation',
  'ClassAssignment',
  'Enrollment',
  'Plan',
  'ClassPeriod',
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
 * `Level.nextLevelId` is `ON DELETE RESTRICT` on `(nextLevelId, schoolId)`, yet the
 * chain needs no unhooking: PostgreSQL checks referential integrity at the end of the
 * statement, and the chain is intra-school since the composite includes `schoolId`. A
 * single scoped `DELETE` therefore removes both ends at once. The fixture chains two
 * levels to lock that down.
 */

/**
 * Runs the purge on the given `pg` client. The transaction belongs to the caller: a
 * failure part-way through must roll the whole cleanup back.
 */
export async function purgeSchool(client, schoolId) {
  if (!schoolId) {
    throw new Error('purgeSchool requires a schoolId')
  }

  await client.query(DELETE_PROVIDER_EVENTS, [schoolId])

  for (const table of SCHOOL_PURGE_TABLES) {
    await client.query(`DELETE FROM "${table}" WHERE "schoolId" = $1`, [schoolId])
  }
}
