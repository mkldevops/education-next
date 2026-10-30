import type { z } from 'zod'
import { readPaymentSchedule, readPlanPricing } from '@/domain/payment-schedule'
import { createPlan } from '@/use-cases/plans/create-plan'
import { updatePlan } from '@/use-cases/plans/update-plan'
import type { DraftScope } from './draft-scope'
import { mcpCreatePlanSchema, mcpUpdatePlanSchema } from './schemas'

/** Publie seulement le prix et l'échéancier, jamais la ligne de persistance entière. */
function configuredPlan(plan: {
  id: string
  name: string
  amount: { toString(): string } | number
  pricing?: unknown
  paymentSchedule?: unknown
}) {
  return {
    id: plan.id,
    name: plan.name,
    amount: plan.amount.toString(),
    pricing: readPlanPricing(plan.pricing, Number(plan.amount)),
    paymentSchedule: readPaymentSchedule(plan.paymentSchedule),
  }
}

export async function createPlanFromMcp(
  scope: Pick<DraftScope, 'schoolId' | 'paymentsEnabled'>,
  input: z.input<typeof mcpCreatePlanSchema>,
  create = createPlan
) {
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const parsed = mcpCreatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const result = await create({ ...parsed.data, schoolId: scope.schoolId })
  return typeof result === 'string' ? result : configuredPlan(result)
}

export async function updatePlanFromMcp(
  scope: Pick<DraftScope, 'schoolId' | 'paymentsEnabled'>,
  input: z.input<typeof mcpUpdatePlanSchema>,
  update = updatePlan
) {
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const parsed = mcpUpdatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const result = await update({ ...parsed.data, schoolId: scope.schoolId })
  return typeof result === 'string' ? result : configuredPlan(result)
}
