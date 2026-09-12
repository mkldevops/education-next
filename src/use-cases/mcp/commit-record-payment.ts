import { z } from 'zod'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { claimDraft } from './claim-draft'
import { RECORD_PAYMENT_TOOL } from './preview-record-payment'
import type { McpScope } from './resolve-mcp-scope'
import { commitDraftSchema } from './schemas'

const resolvedSchema = z.object({
  family: z.object({ id: z.string(), name: z.string() }),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK']),
  reference: z.string().optional(),
  paidAt: z.coerce.date(),
  cashedAt: z.coerce.date().optional(),
  amount: z.number(),
  allocation: z.array(z.object({ enrollmentId: z.string(), amount: z.number() })),
})

type Input = z.infer<typeof commitDraftSchema>

export async function commitRecordPayment(scope: McpScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { draftId, checksum } = parsed.data

  const outcome = await claimDraft(schoolId, RECORD_PAYMENT_TOOL, draftId, checksum)
  if (outcome.status === 'replayed') return outcome.result
  if (outcome.status !== 'claimed') return outcome.status

  const plan = resolvedSchema.safeParse(outcome.resolved)
  if (!plan.success) return 'validationError' as const
  const resolved = plan.data

  const payments = await paymentGateway.createInTransaction(
    schoolId,
    resolved.allocation.map((item) => ({
      familyId: resolved.family.id,
      enrollmentId: item.enrollmentId,
      amount: item.amount,
      method: resolved.method,
      reference: resolved.reference,
      paidAt: resolved.paidAt,
      cashedAt: resolved.cashedAt,
    }))
  )

  const result = {
    familyId: resolved.family.id,
    amount: resolved.amount,
    paymentIds: payments.map((payment) => payment.id),
  }

  await mcpDraftGateway.recordResult(schoolId, draftId, result)

  return result
}
