import type { z } from 'zod'
import { monthOfDay } from '@/domain/childcare'
import { schoolToday } from '@/domain/school-date'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { recordChildcareOpeningSchema } from './schemas'

type Input = z.infer<typeof recordChildcareOpeningSchema>

/**
 * Reprend une garderie réglée avant l'application, d'après une liste papier : les mois jusqu'à
 * `paidThrough` inclus ne doivent plus rien, facturés avant ou après. Aucun reçu, aucun
 * encaissement : la caisse du jour ne voit pas d'argent qu'elle n'a pas reçu. Une seule reprise
 * par enfant, la nouvelle remplace l'ancienne. Un mois futur est refusé, comme à la facturation.
 */
export async function recordChildcareOpening(
  input: Input,
  gateway = childcareGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = recordChildcareOpeningSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, recordedById, studentId, paidThrough, reason } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  if (paidThrough > monthOfDay(schoolToday(timeZone, now))) return 'futureMonth' as const

  return gateway.transaction(async (tx) => {
    if (!(await gateway.studentExists(tx, schoolId, studentId))) return 'notFound' as const
    const subscription = await gateway.lockSubscriptionStart(tx, schoolId, studentId)
    if (!subscription) return 'notSubscribed' as const
    if (paidThrough < subscription.startMonth) return 'invalidPeriod' as const
    await gateway.setOpening(tx, schoolId, subscription.id, { paidThrough, reason, recordedById })
    return 'OK' as const
  })
}
