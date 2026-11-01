import { readFileSync } from 'node:fs'
import {
  calculateTotalAmount,
  NEW_ENROLLMENT_STATUS,
  OPEN_ENROLLMENT_STATUSES,
} from '../src/domain/enrollment'
import {
  findOpenEnrollmentConflicts,
  parseRosterCsv,
  planRosterImport,
  resolveRosterPeople,
  rosterPersonKey,
} from '../src/domain/roster-import'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'

/**
 * Liste de classe de la rentrée, une fois par école.
 *
 *   pnpm db:import-roster <slug> <fichier.csv> --plan <formule> --period <période> [--apply]
 *
 * Sans `--apply`, rien n'est écrit : le script affiche ce qu'il créerait, les doublons
 * ignorés et les mêmes noms de famille à faire valider par l'école. Rejouer le même
 * fichier ne crée rien de plus. Chaque enfant possède une famille, existante ou créée.
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
    where: {
      schoolId,
      classPeriod: { periodId: period.id },
      enrollment: openAssignment.enrollment,
    },
    select: {
      endAt: true,
      classPeriod: { select: { name: true } },
      enrollment: {
        select: { student: { select: { person: { select: { lastname: true, name: true } } } } },
      },
    },
  })

  const people = await prisma.person.findMany({
    where: { schoolId },
    select: {
      id: true,
      lastname: true,
      name: true,
      isActive: true,
      student: { select: { id: true, isActive: true } },
      families: { where: { family: { isActive: true } }, select: { familyId: true } },
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
    assignments
      .filter((item) => item.endAt === null)
      .map((item) => ({
        lastname: item.enrollment.student.person.lastname,
        name: item.enrollment.student.person.name,
        className: item.classPeriod.name,
      }))
  )

  const resolved = resolveRosterPeople(
    [...result.create, ...result.skipped],
    people.map(({ families, ...person }) => ({ ...person, hasActiveFamily: families.length > 0 }))
  )
  const creator = await prisma.schoolMember.findFirst({
    where: { schoolId, roles: { has: 'ADMIN' }, user: { isActive: true } },
    orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
    select: { userId: true },
  })
  const needsFamily = resolved.some(
    (item) => item.kind === 'resolved' && !item.person?.hasActiveFamily
  )

  const uniqueResolved = [
    ...new Map(
      resolved
        .filter((item) => item.kind === 'resolved')
        .map((item) => [rosterPersonKey(item.row), item])
    ).values(),
  ]
  const historicalEnrollmentConflicts = findOpenEnrollmentConflicts(
    result.create,
    assignments.map((item) => ({
      ...item.enrollment.student.person,
      className: item.classPeriod.name,
    }))
  )
  const reused = uniqueResolved.filter((item) => item.kind === 'resolved' && item.person).length
  const newFamilies = uniqueResolved.filter(
    (item) => item.kind === 'resolved' && !item.person?.hasActiveFamily
  ).length
  const repairs = uniqueResolved.filter(
    (item) => item.kind === 'resolved' && item.person?.student && !item.person.hasActiveFamily
  ).length

  console.log(`Identités existantes réutilisées : ${reused}`)
  console.log(
    `Familles à créer : ${newFamilies} (dont ${repairs} pour des élèves existants sans famille)`
  )
  console.log(`Inscriptions à créer : ${result.create.length}`)
  for (const row of result.create) console.log(`  ${row.lastname} ${row.name} (${row.className})`)
  console.log(`Déjà inscrits, ignorés : ${result.skipped.length}`)
  for (const row of result.skipped) console.log(`  ligne ${row.line} : ${row.lastname} ${row.name}`)
  console.log("Même nom de famille, à faire valider par l'école :")
  for (const group of result.sameLastname) {
    console.log(`  ${group.lastname} : ${group.students.join(', ')}`)
  }

  const blocked = [
    ...resolved
      .filter((item) => item.kind !== 'resolved')
      .map(
        (item) =>
          `ligne ${item.row.line} : ${item.kind === 'ambiguous' ? 'homonymes ambigus' : 'personne ou élève archivé'}`
      ),
    ...(needsFamily && !creator
      ? ["aucun administrateur actif de l'école pour créer les familles"]
      : []),
    ...result.conflictingClasses.map(
      (row) => `ligne ${row.line} : élève présent dans plusieurs classes de la période`
    ),
    ...historicalEnrollmentConflicts.map(
      (row) => `ligne ${row.line} : inscription ouverte déjà liée à cette période`
    ),
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
      const identities = new Map<
        string,
        { personId: string; studentId: string | null; hasFamily: boolean }
      >()
      for (const item of resolved) {
        if (item.kind !== 'resolved') continue
        const { row, person } = item
        const key = rosterPersonKey(row)
        let identity = identities.get(key)
        if (!identity) {
          const personId =
            person?.id ??
            (
              await tx.person.create({
                data: { schoolId, lastname: row.lastname, name: row.name },
                select: { id: true },
              })
            ).id
          identity = {
            personId,
            studentId: person?.student?.id ?? null,
            hasFamily: person?.hasActiveFamily ?? false,
          }
          identities.set(key, identity)
        }
        if (!identity.hasFamily) {
          if (!creator) throw new Error('Administrateur introuvable pour créer la famille.')
          const family = await tx.family.create({
            data: { schoolId, name: row.lastname.slice(0, 50), createdById: creator.userId },
            select: { id: true },
          })
          await tx.familyPerson.create({
            data: {
              schoolId,
              familyId: family.id,
              personId: identity.personId,
              relationType: 'OTHER',
            },
          })
          identity.hasFamily = true
        }
        const creation = result.create.find((entry) => entry.line === row.line)
        if (!creation) continue
        if (!identity.studentId) {
          identity.studentId = (
            await tx.student.create({
              data: { schoolId, personId: identity.personId },
              select: { id: true },
            })
          ).id
        }
        const enrollment = await tx.enrollment.create({
          data: {
            schoolId,
            studentId: identity.studentId,
            planId: plan.id,
            totalAmount,
            status: NEW_ENROLLMENT_STATUS,
          },
          select: { id: true },
        })
        await tx.classAssignment.create({
          data: { schoolId, enrollmentId: enrollment.id, classPeriodId: creation.classPeriodId },
        })
      }
    },
    { timeout: 120_000 }
  )
  console.log(`Importé : ${result.create.length} inscriptions.`)
}

main()
  .catch((error) => {
    console.log('Import échoué :', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
