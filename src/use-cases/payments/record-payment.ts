import type { z } from 'zod'
import { distributePayment } from '@/domain/payment'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { readLockedFamilyBalances } from './locked-family-balance'
import { recordPaymentSchema } from './schemas'

type Input = z.infer<typeof recordPaymentSchema>

export async function recordPayment(input: Input, configGw = configGateway) {
  const parsed = recordPaymentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  // Lecture du solde, répartition et écriture dans une seule transaction, sous le verrou
  // de la famille : deux saisies simultanées ne répartissent jamais le même solde.
  return db.$transaction(async (tx) => {
    const balances = await readLockedFamilyBalances(tx, schoolId, familyId)
    if (balances === 'notFound') return 'notFound' as const

    const distribution = distributePayment(parsed.data.amount, balances)
    if (distribution.result !== 'OK') return distribution.result

    await paymentGateway.createForFamily(
      tx,
      schoolId,
      distribution.distribution.map((item) => ({
        familyId,
        enrollmentId: item.enrollmentId,
        amount: item.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        paidAt: parsed.data.paidAt,
        cashedAt: parsed.data.cashedAt,
      }))
    )

    return 'OK' as const
  })
}
