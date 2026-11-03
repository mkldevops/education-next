import { z } from 'zod'
import { allocatePayment } from '@/domain/payment'
import { paymentGateway } from '@/gateways/payment-gateway'
import { readLockedFamilyBalances } from '@/use-cases/payments/locked-family-balance'
import { claimResolved, commitInTransaction } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { RECORD_PAYMENT_TOOL } from './preview-record-payment'
import { commitDraftSchema, mcpPaymentMethodSchema } from './schemas'

const resolvedSchema = z.object({
  family: z.object({ id: z.string(), name: z.string() }),
  method: mcpPaymentMethodSchema,
  reference: z.string().optional(),
  paidAt: z.coerce.date(),
  cashedAt: z.coerce.date().optional(),
  amount: z.number(),
  enrollmentId: z.string().optional(),
  allocation: z.array(z.object({ enrollmentId: z.string(), amount: z.number() })),
})

type Allocation = Array<{ enrollmentId: string; amount: number }>

function sameAllocation(stored: Allocation, fresh: Allocation): boolean {
  if (stored.length !== fresh.length) return false
  return stored.every(
    (item, index) =>
      item.enrollmentId === fresh[index].enrollmentId && item.amount === fresh[index].amount
  )
}

type Input = z.infer<typeof commitDraftSchema>

export async function commitRecordPayment(scope: DraftScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  // Défense en profondeur : refuse même un brouillon préparé avant la coupure (FR-024),
  // sans le réclamer — un `claimDraft` marquerait un brouillon désormais inengageable.
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope

  const claim = await claimResolved(scope, RECORD_PAYMENT_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { draftId, resolved } = claim

  return commitInTransaction(schoolId, draftId, async (tx) => {
    // Les soldes sont relus ici, sous le verrou de la famille, pas seulement au preview :
    // deux brouillons de 100 calculés sur le même solde de 100 encaisseraient sinon 200.
    // Relire dans la transaction ne suffit pas — deux transactions lisent avant que l'une
    // ne valide. Sous le verrou, le second commit attend le premier, relit un solde nul
    // et refuse avant la première écriture.
    const balances = await readLockedFamilyBalances(tx, schoolId, resolved.family.id)
    if (balances === 'notFound') return 'notFound' as const

    const distribution = allocatePayment(resolved.amount, balances, resolved.enrollmentId)
    if (distribution.result !== 'OK') return distribution.result

    // La ventilation validée par l'humain doit rester celle qu'on écrit. Une
    // inscription ajoutée ou un encaissement intercalé la déplace : c'est un nouveau
    // plan à faire relire, pas une répartition à corriger en silence.
    if (!sameAllocation(resolved.allocation, distribution.distribution)) {
      return 'staleDraft' as const
    }

    const payments = await paymentGateway.createForFamily(
      tx,
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

    const written = {
      familyId: resolved.family.id,
      amount: resolved.amount,
      paymentIds: payments,
    }

    return written
  })
}
