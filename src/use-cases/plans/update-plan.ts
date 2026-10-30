import type { z } from 'zod'
import { annualPlanAmount } from '@/domain/payment-schedule'
import { configGateway } from '@/gateways/config-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { updatePlanSchema } from './schemas'

type Input = z.infer<typeof updatePlanSchema>

export async function updatePlan(
  input: Input,
  planGw = planGateway,
  configGw = configGateway,
  regionalSettings = getSchoolRegionalSettings
) {
  const parsed = updatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const
  // Les deux sens comptent. Renommer une formule ordinaire en formule réservée la retire de
  // tous les catalogues et de l'archivage, sans retour depuis l'interface — et `ensureUnpriced`
  // adopterait ensuite son montant, donc une inscription « sans tarif » naîtrait tarifée.
  // Renommer la réservée en ordinaire en ferait recréer une seconde à la coupure suivante.
  if (data.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  const existing = await planGw.findById(schoolId, id)
  if (!existing) return 'notFound' as const
  if (existing.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  const pricing =
    data.pricing ??
    (data.amount === undefined ? undefined : { mode: 'ANNUAL' as const, amount: data.amount })
  if (pricing) {
    const { currency } = await regionalSettings(schoolId)
    if (
      !fitsCurrencyPrecision(pricing.amount, currency) ||
      !fitsCurrencyPrecision(annualPlanAmount(pricing), currency)
    ) {
      return 'validationError' as const
    }
  }
  const plan = await planGw.update(schoolId, id, {
    ...data,
    ...(pricing ? { pricing, amount: annualPlanAmount(pricing) } : {}),
  })
  return plan
}
