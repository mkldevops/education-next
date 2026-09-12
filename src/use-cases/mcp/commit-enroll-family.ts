import { z } from 'zod'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { db } from '@/lib/db'
import { claimDraft } from './claim-draft'
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
      sex: z.enum(['MALE', 'FEMALE']),
      email: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
  ),
  students: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      sex: z.enum(['MALE', 'FEMALE']),
      birthday: z.coerce.date(),
      birthplace: z.string().optional(),
    })
  ),
  classPeriod: z.object({ id: z.string(), name: z.string() }),
  plan: z.object({ id: z.string(), name: z.string(), amount: z.number() }),
  discount: z.number(),
  totalAmount: z.number(),
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

  const outcome = await claimDraft(schoolId, ENROLL_FAMILY_TOOL, draftId, checksum)
  if (outcome.status === 'replayed') return outcome.result
  if (outcome.status !== 'claimed') return outcome.status

  const plan = resolvedSchema.safeParse(outcome.resolved)
  if (!plan.success) return 'validationError' as const
  const resolved = plan.data

  // Une seule transaction, avec des appels `tx.*` directs : aucune passerelle n'accepte
  // un client injecté, et enchaîner les use cases laisserait une famille orpheline au
  // premier échec. Précédent du dépôt : `create-enrollment.ts`.
  const result = await db.$transaction(async (tx) => {
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
    for (const { birthday, birthplace, ...person } of resolved.students) {
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
          planId: resolved.plan.id,
          totalAmount: resolved.totalAmount,
          discount: resolved.discount,
        },
        select: { id: true },
      })

      await tx.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classPeriodId: resolved.classPeriod.id,
          startAt: new Date(),
        },
      })

      students.push({ personId: created.id, studentId: student.id, enrollmentId: enrollment.id })
    }

    const payments: string[] = []
    if (resolved.payment) {
      for (const item of resolved.payment.allocation) {
        const target = students[item.studentIndex]
        if (!target) continue

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

    return {
      familyId: family.id,
      parentIds: parents,
      personIds: students.map((entry) => entry.personId),
      studentIds: students.map((entry) => entry.studentId),
      enrollmentIds: students.map((entry) => entry.enrollmentId),
      paymentIds: payments,
    }
  })

  await mcpDraftGateway.recordResult(schoolId, draftId, result)

  return result
}
