import type { z } from 'zod'
import { coversMonth, isValidRange } from '@/domain/childcare'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { saveChildcareSubscriptionSchema } from './schemas'

type Input = z.infer<typeof saveChildcareSubscriptionSchema>

/**
 * Ouvre ou modifie la garderie d'un enfant. Le nouveau tarif vaut pour les mois à facturer :
 * un mois déjà facturé garde son montant, et une période ne peut pas exclure un mois facturé.
 */
export async function saveChildcareSubscription(
  input: Input,
  gateway = childcareGateway,
  configGw = configGateway
) {
  const parsed = saveChildcareSubscriptionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId, monthlyAmount, startMonth, endMonth } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  if (!isValidRange({ startMonth, endMonth })) return 'invalidPeriod' as const
  const { currency } = await getSchoolRegionalSettings(schoolId)
  if (!fitsCurrencyPrecision(monthlyAmount, currency)) return 'validationError' as const

  return gateway.transaction(async (tx) => {
    if (!(await gateway.studentExists(tx, schoolId, studentId))) return 'notFound' as const
    const subscriptionId = await gateway.lockStudentSubscription(tx, schoolId, studentId)
    if (subscriptionId) {
      const months = await gateway.listLiveMonths(tx, schoolId, subscriptionId)
      if (!months.every((month) => coversMonth({ startMonth, endMonth }, month))) {
        return 'chargesOutsideRange' as const
      }
    }
    await gateway.upsertSubscription(tx, schoolId, {
      studentId,
      monthlyAmount,
      startMonth,
      endMonth,
    })
    return 'OK' as const
  })
}
