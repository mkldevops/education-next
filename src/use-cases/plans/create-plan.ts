import type { z } from 'zod'
import { planGateway } from '@/gateways/plan-gateway'
import { createPlanSchema } from './schemas'

type Input = z.infer<typeof createPlanSchema>

export async function createPlan(input: Input, planGw = planGateway) {
  const parsed = createPlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const plan = await planGw.create(parsed.data)
  return plan
}
