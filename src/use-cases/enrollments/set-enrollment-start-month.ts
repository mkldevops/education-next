import type { z } from 'zod'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { startMonthFromDate, startMonthToDate } from '@/domain/payment-schedule'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { readLockedPaidAmount } from './locked-paid-amount'
import { resolveOwedPlanAmount } from './pricing'
import { setEnrollmentStartMonthSchema } from './schemas'

type Input = z.input<typeof setEnrollmentStartMonthSchema>

/**
 * Fixe — ou efface avec `null` — le mois à partir duquel une inscription doit ses échéances.
 *
 * Le total devient la part de la formule due à partir de ce mois, remise de l'inscription
 * déduite : même règle que `update_enrollment` côté MCP. Un total ramené sous le
 * déjà-encaissé est refusé (`totalBelowPaid`) plutôt que de créer un avoir en silence ; le
 * déjà-payé se relit sous le verrou de la famille, comme pour la remise (#425).
 */
export async function setEnrollmentStartMonth(input: Input) {
  const parsed = setEnrollmentStartMonthSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, enrollmentId, startMonth } = parsed.data

  if (!(await isPaymentsEnabled(schoolId))) return 'paymentsDisabled' as const

  const enrollment = await enrollmentGateway.findById(schoolId, enrollmentId)
  if (!enrollment || !['PENDING', 'ACTIVE'].includes(enrollment.status)) {
    return 'notFound' as const
  }
  if (startMonth === startMonthFromDate(enrollment.startMonth)) return 'OK' as const

  const planAmount = await resolveOwedPlanAmount(
    schoolId,
    enrollmentId,
    enrollment.plan,
    startMonth
  )
  if (typeof planAmount === 'string') return planAmount

  const discount = Number(enrollment.discount)
  if (validateDiscount(planAmount, discount) !== 'OK') return 'discountExceedsPlan' as const
  const totalAmount = calculateTotalAmount(planAmount, discount)

  return db.$transaction(async (tx) => {
    const paid = await readLockedPaidAmount(tx, schoolId, enrollmentId)
    if (paid === 'notFound') return 'notFound' as const
    if (paid > totalAmount) return 'totalBelowPaid' as const

    await enrollmentGateway.updateStartMonth(
      schoolId,
      enrollmentId,
      startMonth ? startMonthToDate(startMonth) : null,
      totalAmount,
      tx
    )

    return 'OK' as const
  })
}
