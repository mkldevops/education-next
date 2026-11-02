import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import {
  type MealImportDecision,
  mealImportAccountKey,
  mealImportCoverageLines,
  planMealImport,
  splitFamilyCodes,
  summarizeMealImport,
} from '../src/domain/meal-import'
import { isSchoolClosed } from '../src/domain/school-closure'
import { db } from '../src/lib/db'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'
import { recordMealOpening } from '../src/use-cases/meals/record-meal-opening'
import { mealImportManifestSchema } from '../src/use-cases/meals/schemas'
import { subscribeMeal } from '../src/use-cases/meals/subscribe-meal'

/**
 * Reprise des abonnements cantine et goûter d'une école, depuis un fichier privé.
 *
 *   pnpm db:import-meals <slug> <fichier.json> --period <période> --canteen-days 1,2,3,4,5 \
 *     --report <fichier.json> [--recorded-by <email>] [--apply]
 *
 * Sans `--apply`, rien n'est écrit. Fichier et rapport portent des noms d'enfants : ils
 * restent hors du dépôt et la sortie standard n'affiche que des totaux. Rejouer le même
 * fichier ne crée rien de plus. Seule `paid` ouvre un compte : une date non contrôlée par
 * l'école reste `uncertain`, avec sa date dans `proposedPaidThrough`, jamais écrite.
 */
const prisma = unscopedDbForDataScripts()

const SERVICES = ['CANTEEN', 'SNACK'] as const

const toDay = (date: Date) => date.toISOString().slice(0, 10)

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function outsideRepository(path: string) {
  if (!relative(process.cwd(), resolve(path)).startsWith('..')) {
    throw new Error(`Données privées attendues hors du dépôt : ${path}`)
  }
  return path
}

function parseWeekdays(value: string) {
  const days = value.split(',').map(Number)
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error(`Jours invalides : ${value}`)
  }
  return days
}

async function readStudents(schoolId: string, periodId: string) {
  const rows = await prisma.student.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      person: {
        select: {
          lastname: true,
          name: true,
          families: {
            where: { family: { isActive: true } },
            select: { familyId: true, relationType: true },
          },
        },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          classAssignments: {
            where: { endAt: null, classPeriod: { periodId } },
            select: { classPeriod: { select: { name: true } } },
          },
        },
      },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    lastname: row.person.lastname,
    name: row.person.name,
    families: row.person.families,
    className:
      row.enrollments.flatMap((item) => item.classAssignments)[0]?.classPeriod.name ?? null,
  }))
}

async function readAccounts(schoolId: string) {
  const rows = await prisma.mealAccount.findMany({
    where: { schoolId },
    select: {
      studentId: true,
      service: true,
      schedules: { select: { weekdays: true, startOn: true, endOn: true } },
      adjustments: { where: { kind: 'OPENING' }, select: { days: true, reason: true } },
      payments: {
        where: { receipt: { cancelledAt: null } },
        select: {
          amount: true,
          daysAdded: true,
          receipt: { select: { paidAt: true } },
        },
      },
    },
  })
  return new Map(
    rows.map((row) => [
      mealImportAccountKey(row.studentId, row.service),
      {
        segments: row.schedules.map((item) => ({
          weekdays: item.weekdays,
          startOn: toDay(item.startOn),
          endOn: item.endOn ? toDay(item.endOn) : null,
        })),
        openings: row.adjustments,
        payments: row.payments.map((item) => ({
          amount: Number(item.amount),
          daysAdded: item.daysAdded,
          on: toDay(item.receipt.paidAt),
        })),
      },
    ])
  )
}

async function applyLine(
  decision: MealImportDecision,
  base: { schoolId: string; periodId: string; recordedById: string | undefined }
) {
  const { line, identity, weekdays, subscription, opening } = decision
  if (identity.status !== 'resolved') return 'unchanged'
  const { schoolId, periodId, recordedById } = base
  const target = { schoolId, studentId: identity.studentId, service: line.service }

  if (subscription === 'create') {
    const done = await subscribeMeal({
      ...target,
      periodId,
      weekdays: [...weekdays],
      startOn: line.startOn,
    })
    if (done !== 'OK') return done
  }
  if (opening.status !== 'create') return subscription === 'create' ? 'OK' : 'unchanged'

  const account = await prisma.mealAccount.findFirst({
    where: { schoolId, studentId: identity.studentId, service: line.service },
    select: {
      adjustments: { where: { kind: 'OPENING' }, select: { id: true } },
      payments: { where: { receipt: { cancelledAt: null } }, select: { id: true } },
    },
  })
  if (account?.adjustments.length || account?.payments.length) return 'modifié entre-temps'

  const paidThrough = line.coverage.state === 'paid' ? line.coverage.paidThrough : ''
  return recordMealOpening({
    ...target,
    paidThrough,
    reason: opening.reason,
    recordedById: recordedById ?? '',
  })
}

async function main() {
  const [slug, file] = process.argv.slice(2).filter((arg, index, args) => {
    return !arg.startsWith('--') && !args[index - 1]?.startsWith('--')
  })
  const periodName = option('--period')
  const canteenDays = option('--canteen-days')
  const reportPath = option('--report')
  const recordedBy = option('--recorded-by')
  if (!slug || !file || !periodName || !canteenDays || !reportPath) {
    throw new Error(
      'Usage : <slug> <fichier.json> --period <période> --canteen-days 1,2,3,4,5 ' +
        '--report <fichier.json> [--recorded-by <email>] [--apply]'
    )
  }
  const apply = process.argv.includes('--apply')
  const manifest = mealImportManifestSchema.parse(
    JSON.parse(readFileSync(outsideRepository(file), 'utf8'))
  )
  outsideRepository(reportPath)

  const school = await prisma.school.findUnique({ where: { slug }, select: { id: true } })
  if (!school) throw new Error(`École inconnue : ${slug}`)
  const schoolId = school.id
  const period = await prisma.period.findFirst({
    where: { schoolId, name: periodName, isActive: true },
    select: { id: true, startAt: true, endAt: true },
  })
  if (!period) throw new Error(`Période inconnue : ${periodName}`)
  const periodStart = toDay(period.startAt)
  const periodEnd = toDay(period.endAt)

  const blocking: string[] = []
  const flag = await prisma.config.findFirst({
    where: { schoolId, name: 'meals_enabled', isActive: true },
    select: { value: true },
  })
  if (flag?.value !== 'true') blocking.push('repas non activés pour cette école')

  const settings = await prisma.mealServiceSetting.findMany({
    where: { schoolId },
    select: { service: true, isEnabled: true, allowedWeekdays: true },
  })
  const allowed = (service: (typeof SERVICES)[number]) =>
    settings.find((item) => item.service === service && item.isEnabled)?.allowedWeekdays
  for (const service of SERVICES) {
    if (!allowed(service)) blocking.push(`service ${service} désactivé`)
  }

  const outside = manifest.lines.filter(
    (line) => line.startOn < periodStart || line.startOn > periodEnd
  )
  if (outside.length > 0) blocking.push(`${outside.length} début(s) hors de la période`)

  const closures = await prisma.event.findMany({
    where: {
      schoolId,
      isActive: true,
      status: 'PUBLISHED',
      category: { in: ['CLOSURE', 'HOLIDAY'] },
    },
    select: { status: true, category: true, startAt: true, endAt: true },
  })
  const isClosed = (day: string) => isSchoolClosed(closures, new Date(`${day}T00:00:00.000Z`))
  for (const day of manifest.requiredClosures) {
    if (!isClosed(day)) blocking.push(`fermeture absente le ${day}`)
  }

  const prices = await prisma.mealPrice.groupBy({
    by: ['service'],
    where: { schoolId },
    _count: { _all: true },
  })
  const warnings = SERVICES.filter(
    (service) => !prices.some((item) => item.service === service)
  ).map((service) => `aucun prix pour ${service}`)

  const usualWeekdays = parseWeekdays(canteenDays)
  const decisions = planMealImport(
    manifest.lines,
    await readStudents(schoolId, period.id),
    await readAccounts(schoolId),
    {
      constatDate: manifest.constatDate,
      periodEnd,
      usualWeekdays,
      allowedWeekdays: { CANTEEN: allowed('CANTEEN') ?? [], SNACK: allowed('SNACK') ?? [] },
      isClosed,
    }
  )

  let recordedById: string | undefined
  if (decisions.some(({ opening }) => opening.status === 'create')) {
    const member = await prisma.schoolMember.findFirst({
      where: {
        schoolId,
        user: { email: recordedBy ?? '' },
        roles: { hasSome: ['ADMIN', 'CASHIER'] },
      },
      select: { userId: true },
    })
    recordedById = member?.userId
    if (!recordedById)
      blocking.push('--recorded-by : compte ADMIN ou CASHIER de cette école requis')
  }

  const outcomes = new Map<MealImportDecision, string>()
  if (apply && blocking.length === 0) {
    for (const decision of decisions) {
      const base = { schoolId, periodId: period.id, recordedById }
      outcomes.set(decision, await applyLine(decision, base))
    }
  }

  const summary = summarizeMealImport(decisions)
  rmSync(reportPath, { force: true })
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        apply,
        blocking,
        warnings,
        summary,
        splitFamilyCodes: splitFamilyCodes(decisions),
        decisions: decisions.map((decision) => ({
          ...decision,
          outcome: outcomes.get(decision) ?? null,
        })),
      },
      null,
      2
    ),
    { mode: 0o600, flag: 'wx' }
  )

  console.log(JSON.stringify(summary))
  for (const status of ['unknown', 'ambiguous', 'noFamily', 'duplicate']) {
    const count = decisions.filter(({ identity }) => identity.status === status).length
    if (count > 0) console.log(`Identité ${status} : ${count}`)
  }
  for (const status of ['reconcile', 'conflict', 'pending']) {
    const count = decisions.filter(({ opening }) => opening.status === status).length
    if (count > 0) console.log(`Ouverture ${status} : ${count}`)
  }
  for (const warning of warnings) console.log(`Attention, ${warning}`)
  for (const reason of blocking) console.log(`Bloquant, ${reason}`)

  const results = [...outcomes.values()]
  const written = results.filter((value) => value === 'OK').length
  const failed = results.filter((value) => !['OK', 'unchanged'].includes(value))
  if (!apply) console.log("Simulation : rien n'a été écrit. Relancer avec --apply.")
  else if (blocking.length === 0) {
    console.log(`Écrit : ${written} ligne(s), ${failed.length} en échec, le reste inchangé.`)
  }
  for (const text of mealImportCoverageLines(decisions)) console.log(text)

  if (apply && blocking.length > 0) {
    throw new Error('Import refusé : corriger les points bloquants.')
  }
  if (failed.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.log('Import échoué :', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => Promise.all([prisma.$disconnect(), db.$disconnect()]))
