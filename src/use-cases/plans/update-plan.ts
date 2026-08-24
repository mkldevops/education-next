import type { z } from 'zod'
import { planGateway } from '@/gateways/plan-gateway'
import { updatePlanSchema } from './schemas'

type Input = z.infer<typeof updatePlanSchema>

export async function updatePlan(input: Input, planGw = planGateway) {
  const parsed = updatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  const plan = await planGw.update(schoolId, id, data)
  return plan
}
