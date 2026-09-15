#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
/**
 * Legacy MySQL → New PostgreSQL migration script
 *
 * Usage:
 *   1. Open SSH tunnels:
 *      ssh -L 13306:ewsscowgokgkswkgwss84c44:3306 -L 15432:josww4c8g8cg4ockccc48w8k:5432 root@145.223.81.185 -N &
 *   2. Export credentials:
 *      export MYSQL_PASSWORD=...
 *      export POSTGRES_PASSWORD=...
 *      export ADMIN_USER_ID=...
 *   3. Run, targeting one existing school:
 *      node scripts/migrate-legacy.mjs --school-id <uuid>
 *
 * Tables migrated: family, person, student, period, package, class_school,
 *                  class_period, package_student_period, class_period_student,
 *                  payment_package_student
 * Skipped: operation*, account*, document, user, etc.
 *
 * The legacy database holds one school. The target database holds several, so the
 * import is confined to `--school-id`: every row is inserted with it, and the
 * cleanup phase only deletes rows carrying it.
 *
 * That cleanup is destructive beyond what this script re-imports. See the header of
 * `scripts/lib/purge-school.mjs`: `UserFamily`, `Invitation`, `PaymentTransaction` and
 * `PaymentProviderEvent` are purged and never written back. Target a school whose
 * business data is expendable.
 */
import mysql from 'mysql2/promise'
import pg from 'pg'
import { splitEmergencyContact } from './lib/emergency-contact.mjs'
import { purgeSchool } from './lib/purge-school.mjs'
import { parseSchoolId } from './lib/school-arg.mjs'

// ─── Config ────────────────────────────────────────────────────────────────

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1'
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '13306', 10)
const PG_HOST = process.env.PG_HOST || '127.0.0.1'
const PG_PORT = parseInt(process.env.PG_PORT || '15432', 10)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const MYSQL_CONFIG = {
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: process.env.MYSQL_USER || 'root',
  password: requireEnv('MYSQL_PASSWORD'),
  database: process.env.MYSQL_DATABASE || 'education_app',
}

const PG_URL =
  process.env.POSTGRES_URL ||
  `postgres://${process.env.POSTGRES_USER || 'app'}:${encodeURIComponent(
    requireEnv('POSTGRES_PASSWORD')
  )}@${PG_HOST}:${PG_PORT}/${process.env.POSTGRES_DATABASE || 'app'}`

const ADMIN_USER_ID = requireEnv('ADMIN_USER_ID')

const SCHOOL_ID = parseSchoolId(process.argv.slice(2))

// ─── Helpers ───────────────────────────────────────────────────────────────

const idMap = {
  family: new Map(),
  person: new Map(),
  student: new Map(),
  period: new Map(),
  plan: new Map(),
  level: new Map(),
  classPeriod: new Map(),
  enrollment: new Map(),
}

function mapId(table, oldId) {
  if (!idMap[table].has(oldId)) {
    idMap[table].set(oldId, randomUUID())
  }
  return idMap[table].get(oldId)
}

function mapSex(gender) {
  if (!gender) return 'MALE'
  const g = gender.toLowerCase()
  return g === 'feminin' || g === 'female' || g === 'f' ? 'FEMALE' : 'MALE'
}

function mapPaymentMethod(method) {
  if (!method) return 'CASH'
  const m = method.toLowerCase()
  if (m.includes('esp')) return 'CASH'
  if (m.includes('chèq') || m.includes('cheq') || m.includes('ch')) return 'CHECK'
  if (m.includes('virement')) return 'TRANSFER'
  if (m.includes('carte') || m.includes('cb') || m.includes('bleu')) return 'CARD'
  return 'CASH'
}

function ts(dt) {
  if (!dt) return new Date()
  return new Date(dt)
}

function trunc(str, max) {
  if (!str) return null
  return str.slice(0, max)
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log(`Target school: ${SCHOOL_ID}`)

  log('Connecting to MySQL (legacy)...')
  const my = await mysql.createConnection(MYSQL_CONFIG)

  log('Connecting to PostgreSQL (new)...')
  const pgClient = new pg.Client({ connectionString: PG_URL })
  await pgClient.connect()

  try {
    // ── Phase 0: Target school ───────────────────────────────────────────

    // Checked before the cleanup: a non-existent id would purge zero row then fail on
    // the first insertion, leaving the impression of an import.
    const school = await pgClient.query('SELECT name FROM "School" WHERE id = $1', [SCHOOL_ID])
    if (school.rowCount === 0) {
      throw new Error(`No school with id ${SCHOOL_ID} in the target database`)
    }
    log(`School found: ${school.rows[0].name}`)

    // ── Phase 1: Fetch legacy data ───────────────────────────────────────

    log('Fetching legacy data...')

    const [families] = await my.query('SELECT * FROM family')
    const [persons] = await my.query('SELECT * FROM person')
    const [students] = await my.query('SELECT * FROM student')
    const [periods] = await my.query('SELECT * FROM period')
    const [packages] = await my.query('SELECT * FROM package')
    const [classSchools] = await my.query('SELECT * FROM class_school')
    const [classPeriods] = await my.query('SELECT * FROM class_period')
    const [enrollments] = await my.query('SELECT * FROM package_student_period')
    const [classStudents] = await my.query('SELECT * FROM class_period_student')
    const [payments] = await my.query(`
      SELECT p.*, o.date AS op_date, og.name AS payment_method
      FROM payment_package_student p
      LEFT JOIN operation o ON o.id = p.operation_id
      LEFT JOIN operation_gender og ON og.id = o.operation_gender_id
    `)

    log(
      `Fetched: ${families.length} families, ${persons.length} persons, ${students.length} students`
    )
    log(`  ${periods.length} periods, ${packages.length} packages, ${classSchools.length} levels`)
    log(`  ${classPeriods.length} class_periods, ${enrollments.length} enrollments`)
    log(`  ${classStudents.length} class_assignments, ${payments.length} payments`)

    // ── Phase 2: Clean new DB ────────────────────────────────────────────

    log('Cleaning target school data (domain data only)...')
    await pgClient.query('BEGIN')
    await purgeSchool(pgClient, SCHOOL_ID)
    await pgClient.query('COMMIT')
    log('Cleaned.')

    // ── Phase 3: Insert reference data ───────────────────────────────────

    await pgClient.query('BEGIN')

    // Periods
    log('Inserting periods...')
    for (const p of periods) {
      const id = mapId('period', p.id)
      await pgClient.query(
        `INSERT INTO "Period" (id, "schoolId", name, "startAt", "endAt", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          SCHOOL_ID,
          trunc(p.name, 50),
          ts(p.begin),
          ts(p.end),
          !!p.enable,
          ts(p.created_at),
          ts(p.updated_at),
        ]
      )
    }

    // Plans (packages)
    log('Inserting plans...')
    for (const p of packages) {
      const id = mapId('plan', p.id)
      await pgClient.query(
        `INSERT INTO "Plan" (id, "schoolId", name, amount, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, SCHOOL_ID, trunc(p.name, 50), p.price, !!p.enable, ts(p.created_at), ts(p.updated_at)]
      )
    }

    // Levels (class_school)
    log('Inserting levels...')
    for (const cs of classSchools) {
      const id = mapId('level', cs.id)
      await pgClient.query(
        `INSERT INTO "Level" (id, "schoolId", name, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, SCHOOL_ID, trunc(cs.name, 250), !!cs.enable, ts(cs.created_at), ts(cs.updated_at)]
      )
    }

    await pgClient.query('COMMIT')
    log('Reference data inserted.')

    // ── Phase 4: Families ────────────────────────────────────────────────

    await pgClient.query('BEGIN')
    log('Inserting families...')
    for (const f of families) {
      const id = mapId('family', f.id)
      const name = f.name || `Famille #${f.id}`
      const emergency = splitEmergencyContact(f.person_emergency)
      await pgClient.query(
        `INSERT INTO "Family" (id, "schoolId", name, "emergencyContactName", "emergencyContactPhone", "authorizedPickup", "createdById", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          SCHOOL_ID,
          trunc(name, 50),
          trunc(emergency.name, 250),
          trunc(emergency.phone, 20),
          f.person_authorized,
          ADMIN_USER_ID,
          !!f.enable,
          ts(f.created_at),
          ts(f.updated_at),
        ]
      )
    }
    await pgClient.query('COMMIT')

    // ── Phase 5: Persons + PhoneNumbers ──────────────────────────────────

    await pgClient.query('BEGIN')
    log('Inserting persons...')
    for (const p of persons) {
      const id = mapId('person', p.id)
      await pgClient.query(
        `INSERT INTO "Person" (id, "schoolId", name, lastname, sex, email, address, "postCode", city, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"Sex", $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          SCHOOL_ID,
          trunc(p.forname || 'Inconnu', 250),
          trunc(p.name || 'Inconnu', 250),
          mapSex(p.gender),
          trunc(p.email, 250),
          trunc(p.address, 250),
          trunc(p.zip, 10),
          trunc(p.city, 250),
          !!p.enable,
          ts(p.created_at),
          ts(p.updated_at),
        ]
      )
      if (p.phone) {
        await pgClient.query(
          `INSERT INTO "PhoneNumber" (id, "schoolId", "personId", "phoneNumber", channels, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            SCHOOL_ID,
            id,
            trunc(p.phone, 20),
            '[]',
            true,
            ts(p.created_at),
            ts(p.updated_at),
          ]
        )
      }
    }
    await pgClient.query('COMMIT')

    // ── Phase 6: FamilyPerson (father/mother/guardian links) ─────────────

    await pgClient.query('BEGIN')
    log('Inserting family-person relationships...')
    const fpInserted = new Set()

    for (const f of families) {
      const familyId = mapId('family', f.id)
      const links = [
        { personOldId: f.father_id, relationType: 'PARENT' },
        { personOldId: f.mother_id, relationType: 'PARENT' },
        { personOldId: f.legal_guardian_id, relationType: 'TUTOR' },
      ]
      for (const link of links) {
        if (!link.personOldId) continue
        const personId = mapId('person', link.personOldId)
        const key = `${familyId}-${personId}`
        if (fpInserted.has(key)) continue
        fpInserted.add(key)
        await pgClient.query(
          `INSERT INTO "FamilyPerson" ("schoolId", "familyId", "personId", "relationType")
           VALUES ($1, $2, $3, $4::"RelationType")`,
          [SCHOOL_ID, familyId, personId, link.relationType]
        )
      }
    }
    await pgClient.query('COMMIT')

    // ── Phase 7: Students ────────────────────────────────────────────────

    await pgClient.query('BEGIN')
    log('Inserting students...')
    const personById = new Map(persons.map((p) => [p.id, p]))

    for (const s of students) {
      const id = mapId('student', s.id)
      const personId = mapId('person', s.person_id)
      const person = personById.get(s.person_id)
      const birthday = person?.birthday || new Date('2010-01-01')
      await pgClient.query(
        `INSERT INTO "Student" (id, "schoolId", "personId", birthday, birthplace, "previousSchool", "healthNotes", "snackAuthorization", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          SCHOOL_ID,
          personId,
          ts(birthday),
          trunc(person?.birthplace, 250),
          trunc(s.last_school, 250),
          s.remarks_health,
          !!s.let_alone,
          !!s.enable,
          ts(s.created_at),
          ts(s.updated_at),
        ]
      )
    }
    await pgClient.query('COMMIT')

    // ── Phase 8: ClassPeriods ────────────────────────────────────────────

    await pgClient.query('BEGIN')
    log('Inserting class periods...')
    for (const cp of classPeriods) {
      const id = mapId('classPeriod', cp.id)
      const levelId = mapId('level', cp.class_school_id)
      const periodId = mapId('period', cp.period_id)
      await pgClient.query(
        `INSERT INTO "ClassPeriod" (id, "schoolId", name, capacity, "levelId", "periodId", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          SCHOOL_ID,
          trunc(`Class ${cp.id}`, 250),
          30,
          levelId,
          periodId,
          !!cp.enable,
          ts(cp.created_at),
          ts(cp.updated_at),
        ]
      )
    }
    await pgClient.query('COMMIT')

    // ── Phase 9: Enrollments (package_student_period) ────────────────────

    await pgClient.query('BEGIN')
    log('Inserting enrollments...')
    const _studentById = new Map(students.map((s) => [s.id, s]))

    for (const e of enrollments) {
      if (!e.student_id) continue
      const id = mapId('enrollment', e.id)
      const studentId = mapId('student', e.student_id)
      const planId = mapId('plan', e.package_id)
      const status = e.paid ? 'COMPLETED' : 'ACTIVE'
      const totalAmount = e.amount ?? 0
      const discount = e.discount ?? 0
      await pgClient.query(
        `INSERT INTO "Enrollment" (id, "schoolId", "studentId", "planId", status, "totalAmount", discount, "registeredAt", "canLeaveAlone", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"EnrollmentStatus", $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          SCHOOL_ID,
          studentId,
          planId,
          status,
          totalAmount,
          discount,
          ts(e.created_at),
          false,
          true,
          ts(e.created_at),
          ts(e.updated_at),
        ]
      )
    }
    await pgClient.query('COMMIT')

    // ── Phase 10: ClassAssignments (class_period_student) ────────────────

    await pgClient.query('BEGIN')
    log('Inserting class assignments...')

    // Build student→enrollment map: find the first enrollment for each student
    const studentEnrollments = new Map()
    for (const e of enrollments) {
      if (!e.student_id) continue
      if (!studentEnrollments.has(e.student_id)) {
        studentEnrollments.set(e.student_id, [])
      }
      studentEnrollments.get(e.student_id).push(e)
    }

    for (const cs of classStudents) {
      if (!cs.student_id || !cs.class_period_id) continue
      // Find a matching enrollment for this student
      const studentEnrolls = studentEnrollments.get(cs.student_id) || []
      // Match by period: class_period has period_id, enrollment has period_id via package_student_period
      const cp = classPeriods.find((c) => c.id === cs.class_period_id)
      let enrollment = studentEnrolls.find((e) => e.period_id === cp?.period_id)
      if (!enrollment) enrollment = studentEnrolls[0]
      if (!enrollment) continue

      const enrollmentId = mapId('enrollment', enrollment.id)
      const classPeriodId = mapId('classPeriod', cs.class_period_id)

      await pgClient.query(
        `INSERT INTO "ClassAssignment" (id, "schoolId", "enrollmentId", "classPeriodId", "startAt", "endAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          SCHOOL_ID,
          enrollmentId,
          classPeriodId,
          ts(cs.begin),
          ts(cs.end),
          ts(cs.created_at),
          ts(cs.updated_at),
        ]
      )
    }
    await pgClient.query('COMMIT')

    // ── Phase 11: Payments ───────────────────────────────────────────────

    await pgClient.query('BEGIN')
    log('Inserting payments...')

    // Build student→family map from person.family_id
    const studentFamilyMap = new Map()
    for (const s of students) {
      const person = personById.get(s.person_id)
      if (person?.family_id) {
        studentFamilyMap.set(s.id, person.family_id)
      }
    }

    // Build enrollment→student map
    const enrollmentStudentMap = new Map()
    for (const e of enrollments) {
      if (e.student_id) {
        enrollmentStudentMap.set(e.id, e.student_id)
      }
    }

    let paymentSkipped = 0
    for (const p of payments) {
      if (!p.package_student_period_id) continue
      const enrollmentId = mapId('enrollment', p.package_student_period_id)

      // Find family through: enrollment → student → person → family
      const studentOldId = enrollmentStudentMap.get(p.package_student_period_id)
      const familyOldId = studentOldId ? studentFamilyMap.get(studentOldId) : null

      if (!familyOldId) {
        paymentSkipped++
        continue
      }
      const familyId = mapId('family', familyOldId)
      const paidAt = p.op_date || p.created_at
      const method = mapPaymentMethod(p.payment_method)
      const amount = p.amount ?? 0

      await pgClient.query(
        `INSERT INTO "Payment" (id, "schoolId", "familyId", "enrollmentId", amount, method, "paidAt", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6::"PaymentMethod", $7, $8, $9, $10)`,
        [
          randomUUID(),
          SCHOOL_ID,
          familyId,
          enrollmentId,
          amount,
          method,
          ts(paidAt),
          !!p.enable,
          ts(p.created_at),
          ts(p.updated_at),
        ]
      )
    }
    if (paymentSkipped > 0) {
      log(`  ⚠ ${paymentSkipped} payments skipped (student has no family link)`)
    }

    await pgClient.query('COMMIT')

    // ── Summary ──────────────────────────────────────────────────────────

    log('')
    log('=== Migration complete ===')
    // Counted on the target school: a global total would mix in the other schools'
    // rows and hide a partial import.
    const counts = await pgClient.query(
      `
      SELECT 'Family' AS tbl, COUNT(*)::int AS n FROM "Family" WHERE "schoolId" = $1
      UNION ALL SELECT 'Person', COUNT(*)::int FROM "Person" WHERE "schoolId" = $1
      UNION ALL SELECT 'PhoneNumber', COUNT(*)::int FROM "PhoneNumber" WHERE "schoolId" = $1
      UNION ALL SELECT 'FamilyPerson', COUNT(*)::int FROM "FamilyPerson" WHERE "schoolId" = $1
      UNION ALL SELECT 'Student', COUNT(*)::int FROM "Student" WHERE "schoolId" = $1
      UNION ALL SELECT 'Period', COUNT(*)::int FROM "Period" WHERE "schoolId" = $1
      UNION ALL SELECT 'Plan', COUNT(*)::int FROM "Plan" WHERE "schoolId" = $1
      UNION ALL SELECT 'Level', COUNT(*)::int FROM "Level" WHERE "schoolId" = $1
      UNION ALL SELECT 'ClassPeriod', COUNT(*)::int FROM "ClassPeriod" WHERE "schoolId" = $1
      UNION ALL SELECT 'Enrollment', COUNT(*)::int FROM "Enrollment" WHERE "schoolId" = $1
      UNION ALL SELECT 'ClassAssignment', COUNT(*)::int FROM "ClassAssignment" WHERE "schoolId" = $1
      UNION ALL SELECT 'Payment', COUNT(*)::int FROM "Payment" WHERE "schoolId" = $1
    `,
      [SCHOOL_ID]
    )
    for (const row of counts.rows) {
      log(`  ${row.tbl.padEnd(20)} ${row.n}`)
    }
  } catch (err) {
    await pgClient.query('ROLLBACK')

    throw err
  } finally {
    await my.end()
    await pgClient.end()
  }
}

main().catch((err) => {
  console.error(`[migrate-legacy] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
