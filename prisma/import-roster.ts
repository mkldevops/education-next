import { readFileSync } from 'node:fs'
import {
  calculateTotalAmount,
  NEW_ENROLLMENT_STATUS,
  OPEN_ENROLLMENT_STATUSES,
} from '../src/domain/enrollment'
import { parseRosterCsv, planRosterImport } from '../src/domain/roster-import'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'

/**
 * Liste de classe de la rentrée, une fois par école.
 *
 *   pnpm db:import-roster <slug> <fichier.csv> --plan <formule> --period <période> [--apply]
 *
 * Sans `--apply`, rien n'est écrit : le script affiche ce qu'il créerait, les doublons
 * ignorés et les mêmes noms de famille à faire valider par l'école. Rejouer le même
 * fichier ne crée rien de plus. Les familles et téléphones sont ajoutés ensuite.
 */
const prisma = unscopedDbForDataScripts()

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main() {
  const [slug, file] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const planName = option('--plan')
  const periodName = option('--period')
  if (!slug || !file || !planName || !periodName) {
    throw new Error('Usage : <slug> <fichier.csv> --plan <formule> --period <période> [--apply]')
  }
  const apply = process.argv.includes('--apply')

  const school = await prisma.school.findUnique({ where: { slug }, select: { id: true } })
  if (!school) throw new Error(`École inconnue : ${slug}`)
  const schoolId = school.id
  const plan = await prisma.plan.findFirst({
    where: { schoolId, name: planName, isActive: true },
    select: { id: true, amount: true },
  })
  if (!plan) throw new Error(`Formule inconnue : ${planName}`)
  const period = await prisma.period.findFirst({
    where: { schoolId, name: periodName, isActive: true },
    select: { id: true },
  })
  if (!period) throw new Error(`Période inconnue : ${periodName}`)

  const openAssignment = {
    endAt: null,
    enrollment: { isActive: true, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
  }
  const classPeriods = await prisma.classPeriod.findMany({
    where: { schoolId, periodId: period.id, isActive: true },
    select: {
      id: true,
      name: true,
      capacity: true,
      _count: { select: { classAssignments: { where: openAssignment } } },
    },
  })
  const assignments = await prisma.classAssignment.findMany({
    where: { schoolId, classPeriod: { periodId: period.id }, ...openAssignment },
    select: {
      classPeriod: { select: { name: true } },
      enrollment: {
        select: { student: { select: { person: { select: { lastname: true, name: true } } } } },
      },
    },
  })

  const { rows, invalid } = parseRosterCsv(readFileSync(file, 'utf8'))
  const result = planRosterImport(
    rows,
    classPeriods.map((item) => ({
      id: item.id,
      name: item.name,
      capacity: item.capacity,
      enrolled: item._count.classAssignments,
    })),
    assignments.map((item) => ({
      lastname: item.enrollment.student.person.lastname,
      name: item.enrollment.student.person.name,
      className: item.classPeriod.name,
    }))
  )

  console.log(`À créer : ${result.create.length}`)
  for (const row of result.create) console.log(`  ${row.lastname} ${row.name} (${row.className})`)
  console.log(`Déjà inscrits, ignorés : ${result.skipped.length}`)
  for (const row of result.skipped) console.log(`  ligne ${row.line} : ${row.lastname} ${row.name}`)
  console.log("Même nom de famille, à faire valider par l'école :")
  for (const group of result.sameLastname) {
    console.log(`  ${group.lastname} : ${group.students.join(', ')}`)
  }

  const blocked = [
    ...invalid.map((line) => `ligne ${line} : trois colonnes nom;prenom;classe attendues`),
    ...result.unknownClass.map((row) => `ligne ${row.line} : classe inconnue ${row.className}`),
    ...result.overCapacity.map(
      (item) => `classe ${item.name} : ${item.total} élèves pour ${item.capacity} places`
    ),
  ]
  for (const reason of blocked) console.log(`Bloquant, ${reason}`)

  if (!apply) {
    console.log("Simulation : rien n'a été écrit. Relancer avec --apply.")
    return
  }
  if (blocked.length > 0) throw new Error('Import refusé : corriger les lignes bloquantes.')

  const totalAmount = calculateTotalAmount(Number(plan.amount), 0)
  await prisma.$transaction(
    async (tx) => {
      for (const row of result.create) {
        const person = await tx.person.create({
          data: { schoolId, lastname: row.lastname, name: row.name },
          select: { id: true },
        })
        const student = await tx.student.create({
          data: { schoolId, personId: person.id },
          select: { id: true },
        })
        const enrollment = await tx.enrollment.create({
          data: {
            schoolId,
            studentId: student.id,
            planId: plan.id,
            totalAmount,
            status: NEW_ENROLLMENT_STATUS,
          },
          select: { id: true },
        })
        await tx.classAssignment.create({
          data: { schoolId, enrollmentId: enrollment.id, classPeriodId: row.classPeriodId },
        })
      }
    },
    { timeout: 120_000 }
  )
  console.log(`Importé : ${result.create.length} élèves.`)
}

main()
  .catch((error) => {
    console.log('Import échoué :', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
