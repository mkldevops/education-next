import { z } from 'zod'
import { NEW_ENROLLMENT_STATUS } from '@/domain/enrollment'
import { startMonthToDate } from '@/domain/payment-schedule'
import { reserveClassSeatsInOrder } from '@/gateways/class-seat-lock'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import { claimResolved, commitInTransaction, releaseDraft } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { countSeatsByClass, ENROLL_FAMILY_TOOL } from './preview-enroll-family'
import { type commitDraftSchema, mcpPaymentMethodSchema, mcpSexSchema } from './schemas'

/**
 * Le plan relu depuis la base est retraversé par un schéma.
 *
 * Le brouillon est du JSON, donc `unknown` au retour de Prisma, et une migration future
 * pourrait laisser en vie des brouillons d'une forme antérieure. Le valider ici coûte un
 * `safeParse` et évite d'ouvrir une transaction sur une forme qu'on ne sait plus écrire.
 */
const resolvedSchema = z.object({
  family: z.union([
    z.object({ id: z.string(), name: z.string() }),
    z.object({
      name: z.string(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      createdById: z.string(),
    }),
  ]),
  parents: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      sex: mcpSexSchema.optional(),
      email: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
  ),
  students: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      sex: mcpSexSchema.optional(),
      birthday: z.coerce.date().optional(),
      birthplace: z.string().optional(),
      personId: z.string().optional(),
      studentId: z.string().optional(),
      classPeriod: z.object({ id: z.string(), name: z.string() }),
      plan: z.object({ id: z.string(), name: z.string(), amount: z.number() }),
      // Absent d'un brouillon antérieur au mois de début : l'inscription commence avec sa période.
      startMonth: z.string().nullable().default(null),
      totalAmount: z.number(),
    })
  ),
  discount: z.number(),
  payment: z
    .object({
      amount: z.number(),
      method: mcpPaymentMethodSchema,
      reference: z.string().optional(),
      paidAt: z.coerce.date(),
      cashedAt: z.coerce.date().optional(),
      allocation: z.array(z.object({ studentIndex: z.number(), amount: z.number() })),
    })
    .nullable(),
})

type Input = z.infer<typeof commitDraftSchema>

export async function commitEnrollFamily(scope: DraftScope, input: Input) {
  const { schoolId } = scope

  const claim = await claimResolved(scope, ENROLL_FAMILY_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { draftId, resolved } = claim

  // L'index d'élève vient d'un brouillon relu : le borner ici plutôt que d'ignorer une
  // ligne hors bornes au milieu de la transaction, ce qui encaisserait un montant partiel
  // sans le dire.
  const allocation = resolved.payment?.allocation ?? []
  if (allocation.some((item) => !resolved.students[item.studentIndex])) {
    await releaseDraft(schoolId, draftId)
    return 'validationError' as const
  }

  // FR-024, mais pas le refus global de ses jumeaux : inscrire reste ouvert quand l'école
  // ne tarife pas, c'est l'objet même du drapeau. Seule la part monétaire du brouillon est
  // refusée — un encaissement ou un total non nul décidés avant la coupure n'ont plus
  // aucun écran pour les restituer. Le verrou est rendu, le brouillon reste engageable si
  // les paiements reviennent.
  const carriesMoney =
    resolved.payment !== null || resolved.students.some((student) => student.totalAmount !== 0)
  if (!scope.paymentsEnabled && carriesMoney) {
    await releaseDraft(schoolId, draftId)
    return 'paymentsDisabled' as const
  }

  // Une seule transaction, avec des appels `tx.*` directs : aucune passerelle n'accepte
  // un client injecté, et enchaîner les use cases laisserait une famille orpheline au
  // premier échec. Précédent du dépôt : `create-enrollment.ts`.
  return commitInTransaction(schoolId, draftId, async (tx) => {
    const existingFamilyId = 'id' in resolved.family ? resolved.family.id : null
    if (existingFamilyId && !(await lockActiveFamily(tx, schoolId, existingFamilyId))) {
      return 'notFound' as const
    }
    // Élèves existants d'abord : verrou (école, élève, période) de `createEnrollment`, pris
    // avant les verrous de classe comme partout ailleurs, pour que la relecture des
    // inscriptions en cours plus bas ne croise pas une inscription concurrente du dashboard.
    const studentPeriodLocks: Array<{ studentId: string; periodId: string }> = []
    for (const student of resolved.students) {
      if (!student.studentId) continue
      const classPeriod = await tx.classPeriod.findUnique({
        where: { id_schoolId: { id: student.classPeriod.id, schoolId } },
        select: { periodId: true },
      })
      if (!classPeriod) return 'notFound' as const
      studentPeriodLocks.push({ studentId: student.studentId, periodId: classPeriod.periodId })
    }
    studentPeriodLocks.sort((a, b) =>
      `${a.studentId}:${a.periodId}`.localeCompare(`${b.studentId}:${b.periodId}`)
    )
    for (const { studentId, periodId } of studentPeriodLocks) {
      await enrollmentGateway.lockStudentInPeriod(tx, schoolId, studentId, periodId)
    }

    // Les classes sont recomptées ici, sous verrou de ligne, pas seulement au preview : deux
    // brouillons calculés sur la même place libre s'engageraient sinon tous les deux. Une
    // réservation par classe visée : une fratrie répartie sur trois classes ne prend pas trois
    // places dans chacune. Le refus sort avant la première écriture.
    const seats = await reserveClassSeatsInOrder(
      tx,
      schoolId,
      countSeatsByClass(resolved.students.map((student) => student.classPeriod.id))
    )
    if (seats !== 'OK') return seats

    // Une famille visée par son identifiant, et chaque membre retrouvé, sont relus avant
    // la première écriture : une famille archivée ou un enfant inscrit depuis le preview
    // refusent l'engagement au lieu d'ouvrir une seconde inscription.
    for (const student of resolved.students) {
      if (!student.personId) continue
      if (!existingFamilyId) return 'validationError' as const

      const member = await tx.person.findFirst({
        where: {
          id: student.personId,
          schoolId,
          isActive: true,
          families: { some: { familyId: existingFamilyId, relationType: { not: 'PARENT' } } },
        },
        select: {
          student: {
            select: {
              id: true,
              isActive: true,
              enrollments: {
                where: { isActive: true, status: { in: ['PENDING', 'ACTIVE'] } },
                select: { id: true },
              },
            },
          },
        },
      })
      if (!member || (member.student && !member.student.isActive)) return 'notFound' as const
      if ((member.student?.id ?? undefined) !== student.studentId) return 'staleDraft' as const
      if (member.student && member.student.enrollments.length > 0) {
        return 'duplicateEnrollment' as const
      }
    }

    // La formule aussi, une relecture par formule visée : entre le preview et le commit,
    // l'admin peut l'archiver (autorisé tant qu'aucune inscription ouverte ne la porte —
    // et celle-ci n'existe pas encore) ou changer son prix. Sans cette relecture, l'inscription
    // naîtrait sur une formule morte ou au montant validé sur un prix périmé. Même règle que
    // `commit-update-enrollment.ts` : disparue → `notFound`, prix bougé → `staleDraft`.
    const currentPlanAmounts = new Map<string, number | null>()
    for (const { plan } of resolved.students) {
      if (!currentPlanAmounts.has(plan.id)) {
        const current = await tx.plan.findFirst({
          where: { id: plan.id, schoolId, isActive: true },
          select: { amount: true },
        })
        currentPlanAmounts.set(plan.id, current ? Number(current.amount) : null)
      }
      const currentAmount = currentPlanAmounts.get(plan.id)
      if (currentAmount === null) return 'notFound' as const
      if (currentAmount !== plan.amount) return 'staleDraft' as const
    }

    const family =
      'id' in resolved.family
        ? await tx.family.findFirst({
            where: { id: resolved.family.id, schoolId, isActive: true },
            select: { id: true },
          })
        : await tx.family.create({
            data: { ...resolved.family, schoolId },
            select: { id: true },
          })
    if (!family) return 'notFound' as const

    // Les créations imbriquées ne répètent pas `schoolId` : `FamilyPerson` et `PhoneNumber`
    // pointent la personne par la clé composite `(personId, schoolId)`, que Prisma remplit
    // depuis le parent et refuse en argument. Précédent : `personGateway.createWithFamily`.
    const parents: string[] = []
    for (const { phoneNumber, ...person } of resolved.parents) {
      const created = await tx.person.create({
        data: {
          ...person,
          schoolId,
          families: { create: { familyId: family.id, relationType: 'PARENT' } },
          ...(phoneNumber ? { phoneNumbers: { create: { phoneNumber, channels: [] } } } : {}),
        },
        select: { id: true },
      })
      parents.push(created.id)
    }

    const students: Array<{ personId: string; studentId: string; enrollmentId: string }> = []
    for (const {
      birthday,
      birthplace,
      personId,
      studentId,
      classPeriod,
      plan,
      startMonth,
      totalAmount,
      ...person
    } of resolved.students) {
      const created = personId
        ? { id: personId }
        : await tx.person.create({
            data: {
              ...person,
              schoolId,
              families: { create: { familyId: family.id, relationType: 'OTHER' } },
            },
            select: { id: true },
          })

      const student = studentId
        ? { id: studentId }
        : await tx.student.create({
            data: { schoolId, personId: created.id, birthday, birthplace },
            select: { id: true },
          })

      const enrollment = await tx.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          planId: plan.id,
          totalAmount,
          discount: resolved.discount,
          startMonth: startMonth ? startMonthToDate(startMonth) : null,
          status: NEW_ENROLLMENT_STATUS,
        },
        select: { id: true },
      })

      await tx.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classPeriodId: classPeriod.id,
          startAt: new Date(),
        },
      })

      students.push({ personId: created.id, studentId: student.id, enrollmentId: enrollment.id })
    }

    const payments: string[] = []
    if (resolved.payment) {
      for (const item of allocation) {
        const target = students[item.studentIndex]

        const payment = await tx.payment.create({
          data: {
            schoolId,
            familyId: family.id,
            enrollmentId: target.enrollmentId,
            amount: item.amount,
            method: resolved.payment.method,
            reference: resolved.payment.reference,
            paidAt: resolved.payment.paidAt,
            cashedAt: resolved.payment.cashedAt,
          },
          select: { id: true },
        })
        payments.push(payment.id)
      }
    }

    const written = {
      familyId: family.id,
      parentIds: parents,
      personIds: students.map((entry) => entry.personId),
      studentIds: students.map((entry) => entry.studentId),
      enrollmentIds: students.map((entry) => entry.enrollmentId),
      paymentIds: payments,
    }

    return written
  })
}
