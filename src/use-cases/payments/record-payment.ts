import type { z } from 'zod'
import { distributePayment, enrollmentBalances } from '@/domain/payment'
import { configGateway } from '@/gateways/config-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { recordPaymentSchema } from './schemas'

type Input = z.infer<typeof recordPaymentSchema>

export async function recordPayment(input: Input, configGw = configGateway) {
  const parsed = recordPaymentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const family = await familyGateway.findById(schoolId, parsed.data.familyId)
  if (!family) return 'notFound' as const

  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, parsed.data.familyId)

  const distribution = distributePayment(parsed.data.amount, enrollmentBalances(enrollments))
  if (distribution.result !== 'OK') return distribution.result

  await paymentGateway.createInTransaction(
    schoolId,
    distribution.distribution.map((item) => ({
      familyId: parsed.data.familyId,
      enrollmentId: item.enrollmentId,
      amount: item.amount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      paidAt: parsed.data.paidAt,
      cashedAt: parsed.data.cashedAt,
    }))
  )

  return 'OK' as const
}
