import type { z } from 'zod'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { cancelChildcareChargeSchema } from './schemas'

type Input = z.infer<typeof cancelChildcareChargeSchema>

/**
 * Annule un mois facturé par erreur, sans l'effacer. Un mois encaissé reste dû tant que son
 * reçu n'est pas annulé : on annule d'abord le reçu, pour que la caisse suive l'argent.
 */
export async function cancelChildcareCharge(
  input: Input,
  gateway = childcareGateway,
  configGw = configGateway
) {
  const parsed = cancelChildcareChargeSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, chargeId, cancelledById, reason } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  return gateway.transaction(async (tx) => {
    const [charge] = await gateway.lockCharges(tx, schoolId, [chargeId])
    if (!charge) return 'notFound' as const
    if (charge.cancelled) return 'alreadyCancelled' as const
    if (charge.paid > 0) return 'hasPayments' as const
    await gateway.cancelCharge(tx, schoolId, chargeId, { cancelledById, cancelReason: reason })
    return 'OK' as const
  })
}
