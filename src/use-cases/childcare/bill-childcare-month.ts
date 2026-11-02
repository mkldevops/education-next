import type { z } from 'zod'
import { monthOfDay, planChildcareBilling } from '@/domain/childcare'
import { schoolToday } from '@/domain/school-date'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { billChildcareMonthSchema } from './schemas'

type Input = z.infer<typeof billChildcareMonthSchema>

/**
 * Facture un mois choisi par l'école, seule façon de créer une dette de garderie. Les
 * garderies restent verrouillées pendant le calcul, et un mois déjà facturé n'est pas
 * touché : rejouer la facturation ne compte rien deux fois. Un mois futur est refusé.
 */
export async function billChildcareMonth(
  input: Input,
  gateway = childcareGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = billChildcareMonthSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, recordedById, month } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  if (month > monthOfDay(schoolToday(timeZone, now))) return 'futureMonth' as const

  return gateway.transaction(async (tx) => {
    const subscriptions = await gateway.lockBillableSubscriptions(tx, schoolId)
    const charges = await gateway.listMonthCharges(
      tx,
      schoolId,
      month,
      subscriptions.map((subscription) => subscription.id)
    )
    const plan = planChildcareBilling({ month, subscriptions, charges })
    if (plan.toCreate.length > 0) {
      await gateway.createCharges(tx, schoolId, month, recordedById, plan.toCreate)
    }
    for (const charge of plan.toRevive) {
      await gateway.reviveCharge(tx, schoolId, charge.id, recordedById, charge.amount)
    }
    return {
      billed: plan.toCreate.length + plan.toRevive.length,
      alreadyBilled: plan.alreadyBilled,
      outsideRange: plan.outsideRange,
    }
  })
}
