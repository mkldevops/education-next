import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { createPlanSchema } from './schemas'

type Input = z.infer<typeof createPlanSchema>

export async function createPlan(input: Input, planGw = planGateway, configGw = configGateway) {
  const parsed = createPlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const
  if (data.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  const plan = await planGw.create(schoolId, data)
  return plan
}
