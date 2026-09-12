import { z } from 'zod'
import { distributePayment, enrollmentBalances } from '@/domain/payment'
import { db } from '@/lib/db'
import { claimDraft, releaseDraft } from './claim-draft'
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

type Allocation = Array<{ enrollmentId: string; amount: number }>

function sameAllocation(stored: Allocation, fresh: Allocation): boolean {
  if (stored.length !== fresh.length) return false
  return stored.every(
    (item, index) =>
      item.enrollmentId === fresh[index].enrollmentId && item.amount === fresh[index].amount
  )
}

type Input = z.infer<typeof commitDraftSchema>

export async function commitRecordPayment(scope: McpScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { draftId, checksum } = parsed.data

  const outcome = await claimDraft(schoolId, scope.keyId, RECORD_PAYMENT_TOOL, draftId, checksum)
  if (outcome.status === 'replayed') return outcome.result
  if (outcome.status !== 'claimed') return outcome.status

  const plan = resolvedSchema.safeParse(outcome.resolved)
  if (!plan.success) {
    await releaseDraft(schoolId, draftId)
    return 'validationError' as const
  }
  const resolved = plan.data

  try {
    const result = await db.$transaction(async (tx) => {
      // Les soldes sont relus ici, pas seulement au preview : deux brouillons de 100
      // calculés sur le même solde de 100 encaisseraient sinon 200. Le refus sort avant
      // la première écriture, comme dans `create-enrollment.ts`.
      const enrollments = await tx.enrollment.findMany({
        where: {
          schoolId,
          status: { in: ['PENDING', 'ACTIVE'] },
          student: { person: { families: { some: { familyId: resolved.family.id } } } },
        },
        include: { payments: { where: { isActive: true } } },
        orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
      })

      const distribution = distributePayment(resolved.amount, enrollmentBalances(enrollments))
      if (distribution.result !== 'OK') return distribution.result

      // La ventilation validée par l'humain doit rester celle qu'on écrit. Une
      // inscription ajoutée ou un encaissement intercalé la déplace : c'est un nouveau
      // plan à faire relire, pas une répartition à corriger en silence.
      if (!sameAllocation(resolved.allocation, distribution.distribution)) {
        return 'staleDraft' as const
      }

      const payments: string[] = []
      for (const item of resolved.allocation) {
        const payment = await tx.payment.create({
          data: {
            schoolId,
            familyId: resolved.family.id,
            enrollmentId: item.enrollmentId,
            amount: item.amount,
            method: resolved.method,
            reference: resolved.reference,
            paidAt: resolved.paidAt,
            cashedAt: resolved.cashedAt,
          },
          select: { id: true },
        })
        payments.push(payment.id)
      }

      const written = {
        familyId: resolved.family.id,
        amount: resolved.amount,
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
