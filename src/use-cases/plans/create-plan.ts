import type { z } from 'zod'
import { annualPlanAmount } from '@/domain/payment-schedule'
import { configGateway } from '@/gateways/config-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { createPlanSchema } from './schemas'

type Input = z.infer<typeof createPlanSchema>

export async function createPlan(
  input: Input,
  planGw = planGateway,
  configGw = configGateway,
  regionalSettings = getSchoolRegionalSettings
) {
  const parsed = createPlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const
  if (data.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  const amount = data.pricing ? annualPlanAmount(data.pricing) : data.amount
  if (amount === undefined) return 'validationError' as const
  const pricing = data.pricing ?? { mode: 'ANNUAL' as const, amount }
  const { currency } = await regionalSettings(schoolId)
  if (
    !fitsCurrencyPrecision(amount, currency) ||
    !fitsCurrencyPrecision(pricing.amount, currency)
  ) {
    return 'validationError' as const
  }
  const plan = await planGw.create(schoolId, {
    ...data,
    amount: annualPlanAmount(pricing),
    pricing,
  })
  return plan
}
