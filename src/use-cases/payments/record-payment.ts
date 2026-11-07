import type { z } from 'zod'
import { allocatePayment } from '@/domain/payment'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { db } from '@/lib/db'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { issueTuitionReceipt } from '@/use-cases/receipts/issue-tuition-receipt'
import { readLockedFamilyBalances } from './locked-family-balance'
import { recordPaymentSchema } from './schemas'

type Input = z.infer<typeof recordPaymentSchema>

/**
 * Saisie manuelle d'un règlement d'écolage, réparti sur les inscriptions de la famille.
 * Avec `generateReceipt`, l'encaissement reçoit un reçu numéroté : le succès porte alors son id.
 */
export async function recordPayment(input: Input, configGw = configGateway) {
  const parsed = recordPaymentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const
  const { currency } = await getSchoolRegionalSettings(schoolId)
  if (!fitsCurrencyPrecision(parsed.data.amount, currency)) return 'validationError' as const

  // Lecture du solde, répartition et écriture dans une seule transaction, sous le verrou
  // de la famille : deux saisies simultanées ne répartissent jamais le même solde.
  return db.$transaction(async (tx) => {
    const balances = await readLockedFamilyBalances(tx, schoolId, familyId)
    if (balances === 'notFound') return 'notFound' as const

    const distribution = allocatePayment(parsed.data.amount, balances, parsed.data.enrollmentId)
    if (distribution.result !== 'OK') return distribution.result

    const rows = distribution.distribution
    const ids = await paymentGateway.createForFamily(
      tx,
      schoolId,
      rows.map((item) => ({
        familyId,
        enrollmentId: item.enrollmentId,
        amount: item.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        paidAt: parsed.data.paidAt,
        cashedAt: parsed.data.cashedAt,
      }))
    )

    const { generateReceipt, recordedById } = parsed.data
    if (!generateReceipt || !recordedById) return 'OK' as const
    const receipt = await issueTuitionReceipt(tx, schoolId, {
      familyId,
      method: parsed.data.method,
      reference: parsed.data.reference || null,
      paidAt: parsed.data.paidAt,
      recordedById,
      idempotencyKey: `payment:${ids[0]}`,
      payments: rows.map((row, index) => ({ id: ids[index], amount: row.amount })),
    })
    return { receiptId: receipt.id }
  })
}
