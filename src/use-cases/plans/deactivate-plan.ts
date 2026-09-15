import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { deactivatePlanSchema } from './schemas'

type Input = z.infer<typeof deactivatePlanSchema>

export async function deactivatePlan(input: Input, planGw = planGateway, configGw = configGateway) {
  const parsed = deactivatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, id } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const plan = await planGw.findById(schoolId, id)
  if (!plan) return 'notFound' as const
  if (plan.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  // Une inscription close garde sa formule archivée : seule une inscription encore à
  // facturer ou à modifier a besoin d'une formule sélectionnable.
  const openEnrollments = await planGw.countOpenEnrollments(schoolId, id)
  if (openEnrollments > 0) return 'planInUse' as const

  await planGw.deactivate(schoolId, id)
  return 'OK' as const
}
