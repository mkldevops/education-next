import { z } from 'zod'
import { roundHalfUp } from '@/lib/decimal'
import { claimResolved, commitInTransaction } from './claim-draft'
import { paidAmount, UPDATE_ENROLLMENT_TOOL } from './preview-update-enrollment'
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

  const claim = await claimResolved(scope, UPDATE_ENROLLMENT_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { draftId } = claim
  const { enrollment, before, after } = claim.resolved

  return commitInTransaction(schoolId, draftId, async (tx) => {
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
    const paid = paidAmount(current.payments)
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

    return written
  })
}
