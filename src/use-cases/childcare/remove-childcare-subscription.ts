import type { z } from 'zod'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { removeChildcareSubscriptionSchema } from './schemas'

type Input = z.infer<typeof removeChildcareSubscriptionSchema>

/** Retire une garderie saisie par erreur : un mois facturé ou encaissé la retient. */
export async function removeChildcareSubscription(
  input: Input,
  gateway = childcareGateway,
  configGw = configGateway
) {
  const parsed = removeChildcareSubscriptionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  return gateway.transaction(async (tx) => {
    const subscriptionId = await gateway.lockStudentSubscription(tx, schoolId, studentId)
    if (!subscriptionId) return 'notFound' as const
    if (await gateway.hasBillingHistory(tx, schoolId, subscriptionId)) {
      return 'hasCharges' as const
    }
    await gateway.deleteSubscription(tx, schoolId, subscriptionId)
    return 'OK' as const
  })
}
