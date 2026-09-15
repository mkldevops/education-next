import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { updatePlanSchema } from './schemas'

type Input = z.infer<typeof updatePlanSchema>

export async function updatePlan(input: Input, planGw = planGateway, configGw = configGateway) {
  const parsed = updatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const plan = await planGw.update(schoolId, id, data)
  return plan
}
