import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { readLockedPaidAmount } from './locked-paid-amount'
import { resolveEnrollmentPricing } from './pricing'
import { applyDiscountSchema } from './schemas'

type Input = z.input<typeof applyDiscountSchema>

export async function applyDiscount(input: Input, configGw = configGateway) {
  const parsed = applyDiscountSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, enrollmentId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const enrollment = await enrollmentGateway.findById(schoolId, enrollmentId)
  if (!enrollment) return 'notFound' as const
  if (enrollment.status && !['PENDING', 'ACTIVE'].includes(enrollment.status)) {
    return 'notFound' as const
  }

  const pricing = resolveEnrollmentPricing(
    Number(enrollment.plan.amount),
    parsed.data.discount,
    parsed.data.totalAmount
  )
  if (typeof pricing === 'string') return pricing
  const { discount, totalAmount } = pricing

  // Le solde ne descend jamais sous zéro : le déjà-payé se relit sous le verrou de la
  // famille, dans la transaction qui écrit le total — un encaissement simultané attend
  // puis voit le nouveau total, au lieu de passer sur l'ancien (#425).
  return db.$transaction(async (tx) => {
    const totalPaid = await readLockedPaidAmount(tx, schoolId, enrollmentId)
    if (totalPaid === 'notFound') return 'notFound' as const
    if (totalAmount < totalPaid) return 'totalBelowPaid' as const

    await enrollmentGateway.updateDiscount(schoolId, enrollmentId, discount, totalAmount, tx)

    return 'OK' as const
  })
}
