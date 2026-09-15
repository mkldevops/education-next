import { z } from 'zod'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'
import { claimDraft, releaseDraft } from './claim-draft'
import { UPDATE_ENROLLMENT_TOOL } from './preview-update-enrollment'
import type { McpScope } from './resolve-mcp-scope'
import { commitDraftSchema } from './schemas'

const pricingSchema = z.object({
  plan: z.object({ id: z.string(), name: z.string(), amount: z.number() }),
  discount: z.number(),
  totalAmount: z.number(),
})

const resolvedSchema = z.object({
  enrollment: z.object({ id: z.string(), student: z.string() }),
  before: pricingSchema,
  after: pricingSchema,
})

type Input = z.infer<typeof commitDraftSchema>

export async function commitUpdateEnrollment(scope: McpScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  // Défense en profondeur : refuse même un brouillon préparé avant la coupure (FR-024),
  // sans le réclamer — un `claimDraft` marquerait un brouillon désormais inengageable.
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope
  const { draftId, checksum } = parsed.data

  const outcome = await claimDraft(schoolId, scope.keyId, UPDATE_ENROLLMENT_TOOL, draftId, checksum)
  if (outcome.status === 'replayed') return outcome.result
  if (outcome.status !== 'claimed') return outcome.status

  const plan = resolvedSchema.safeParse(outcome.resolved)
  if (!plan.success) {
    await releaseDraft(schoolId, draftId)
    return 'validationError' as const
  }
  const { enrollment, before, after } = plan.data

  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.enrollment.findFirst({
        where: { id: enrollment.id, schoolId, status: { in: ['PENDING', 'ACTIVE'] } },
        select: {
          planId: true,
          discount: true,
          totalAmount: true,
          payments: { where: { isActive: true }, select: { amount: true } },
        },
      })
      if (!current) return 'notFound' as const

      // L'humain a validé un passage « de → à ». Une inscription modifiée entre-temps, ou
      // une formule dont le prix a bougé, en fait un autre plan à relire.
      if (
        current.planId !== before.plan.id ||
        Number(current.discount) !== before.discount ||
        Number(current.totalAmount) !== before.totalAmount
      ) {
        return 'staleDraft' as const
      }

      const target = await tx.plan.findFirst({
        where: { id: after.plan.id, schoolId, isActive: true },
        select: { amount: true },
      })
      if (!target) return 'notFound' as const
      if (Number(target.amount) !== after.plan.amount) return 'staleDraft' as const

      // Un encaissement intercalé depuis le preview peut dépasser le nouveau total.
      const paid = roundHalfUp(
        current.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      )
      if (paid > after.totalAmount) return 'totalBelowPaid' as const

      await tx.enrollment.update({
        where: { id_schoolId: { id: enrollment.id, schoolId } },
        data: {
          planId: after.plan.id,
          discount: after.discount,
          totalAmount: after.totalAmount,
        },
      })

      const written = {
        enrollmentId: enrollment.id,
        planId: after.plan.id,
        discount: after.discount,
        totalAmount: after.totalAmount,
        remaining: roundHalfUp(after.totalAmount - paid),
      }

      // Le résultat est écrit dans la transaction qui écrit les données : `result` nul
      // signifie alors « rien n'a été écrit », ce qui rend le verrou reprenable.
      await tx.mcpDraft.updateMany({ where: { id: draftId, schoolId }, data: { result: written } })

      return written
    })

    if (typeof result === 'string') await releaseDraft(schoolId, draftId)

    return result
  } catch (error) {
    await releaseDraft(schoolId, draftId)
    throw error
  }
}
