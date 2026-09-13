import { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { db } from '@/lib/db'
import { claimDraft, releaseDraft } from './claim-draft'
import { ENROLL_FAMILY_TOOL } from './preview-enroll-family'
import type { McpScope } from './resolve-mcp-scope'
import { commitDraftSchema } from './schemas'

/**
 * Le plan relu depuis la base est retraversé par un schéma.
 *
 * Le brouillon est du JSON, donc `unknown` au retour de Prisma, et une migration future
 * pourrait laisser en vie des brouillons d'une forme antérieure. Le valider ici coûte un
 * `safeParse` et évite d'ouvrir une transaction sur une forme qu'on ne sait plus écrire.
 */
const resolvedSchema = z.object({
  family: z.object({
    name: z.string(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    createdById: z.string(),
  }),
  parents: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      sex: z.enum(['MALE', 'FEMALE']).optional(),
      email: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
  ),
  students: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      sex: z.enum(['MALE', 'FEMALE']).optional(),
      birthday: z.coerce.date().optional(),
      birthplace: z.string().optional(),
      classPeriod: z.object({ id: z.string(), name: z.string() }),
      plan: z.object({ id: z.string(), name: z.string(), amount: z.number() }),
      totalAmount: z.number(),
    })
  ),
  discount: z.number(),
  payment: z
    .object({
      amount: z.number(),
      method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK']),
      reference: z.string().optional(),
      paidAt: z.coerce.date(),
      cashedAt: z.coerce.date().optional(),
      allocation: z.array(z.object({ studentIndex: z.number(), amount: z.number() })),
    })
    .nullable(),
})

type Input = z.infer<typeof commitDraftSchema>

export async function commitEnrollFamily(scope: McpScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { draftId, checksum } = parsed.data

  const outcome = await claimDraft(schoolId, scope.keyId, ENROLL_FAMILY_TOOL, draftId, checksum)
  if (outcome.status === 'replayed') return outcome.result
  if (outcome.status !== 'claimed') return outcome.status

  const plan = resolvedSchema.safeParse(outcome.resolved)
  if (!plan.success) {
    await releaseDraft(schoolId, draftId)
    return 'validationError' as const
  }
  const resolved = plan.data

  // L'index d'élève vient d'un brouillon relu : le borner ici plutôt que d'ignorer une
  // ligne hors bornes au milieu de la transaction, ce qui encaisserait un montant partiel
  // sans le dire.
  const allocation = resolved.payment?.allocation ?? []
  if (allocation.some((item) => !resolved.students[item.studentIndex])) {
    await releaseDraft(schoolId, draftId)
    return 'validationError' as const
  }

  // Une seule transaction, avec des appels `tx.*` directs : aucune passerelle n'accepte
  // un client injecté, et enchaîner les use cases laisserait une famille orpheline au
  // premier échec. Précédent du dépôt : `create-enrollment.ts`.
  try {
    const result = await db.$transaction(async (tx) => {
      // Les classes sont recomptées ici, pas seulement au preview : deux brouillons
      // calculés sur la même place libre s'engageraient sinon tous les deux. Même
      // prédicat que `create-enrollment.ts`, et le refus sort avant la première écriture.
      // Une par classe visée : une fratrie répartie sur trois classes ne prend pas trois
      // places dans chacune.
      const seatsWanted = new Map<string, number>()
      for (const student of resolved.students) {
        const id = student.classPeriod.id
        seatsWanted.set(id, (seatsWanted.get(id) ?? 0) + 1)
      }

      for (const [classPeriodId, wanted] of seatsWanted) {
        const classPeriod = await tx.classPeriod.findUnique({
          where: { id_schoolId: { id: classPeriodId, schoolId } },
          select: { capacity: true },
        })
        if (!classPeriod) return 'notFound' as const

        const enrolled = await tx.classAssignment.count({
          where: {
            schoolId,
            classPeriodId,
            endAt: null,
            enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
          },
        })

        // `checkCapacity` répond pour une place : on lui présente la classe une fois les
        // premiers élèves assis, donc `wanted - 1` en plus.
        if (checkCapacity(classPeriod.capacity, enrolled + wanted - 1) !== 'OK') {
          return 'classFull' as const
        }
      }

      const family = await tx.family.create({
        data: { ...resolved.family, schoolId },
        select: { id: true },
      })

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
        classPeriod,
        plan,
        totalAmount,
        ...person
      } of resolved.students) {
        const created = await tx.person.create({
          data: {
            ...person,
            schoolId,
            families: { create: { familyId: family.id, relationType: 'OTHER' } },
          },
          select: { id: true },
        })

        const student = await tx.student.create({
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

      // Le résultat est écrit dans la transaction qui écrit les données : `result` nul
      // signifie alors « rien n'a été écrit », ce qui rend le verrou reprenable.
      await tx.mcpDraft.updateMany({ where: { id: draftId, schoolId }, data: { result: written } })

      return written
    })

    // Un refus constaté au commit n'a rien écrit : rendre le verrou laisse le client
    // refaire un `preview_*` sans attendre le délai d'abandon.
    if (typeof result === 'string') await releaseDraft(schoolId, draftId)

    return result
  } catch (error) {
    // La transaction a été annulée, résultat compris. Sans ce rattrapage le brouillon
    // resterait engagé sans résultat, donc injoignable jusqu'au délai d'abandon.
    await releaseDraft(schoolId, draftId)
    throw error
  }
}
