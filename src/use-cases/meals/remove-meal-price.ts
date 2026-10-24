import type { z } from 'zod'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealGateway } from '@/gateways/meal-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { removeMealPriceSchema } from './schemas'

type Input = z.infer<typeof removeMealPriceSchema>

/** Seul un tarif pas encore en vigueur se retire : les autres ont pu servir un encaissement. */
export async function removeMealPrice(
  input: Input,
  mealGw = mealGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = removeMealPriceSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const price = await mealGw.findPrice(schoolId, id)
  if (!price) return 'notFound' as const

  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  if (price.effectiveFrom.toISOString().slice(0, 10) <= schoolToday(timeZone, now)) {
    return 'alreadyEffective' as const
  }

  await mealGw.deletePrice(schoolId, id)
  return 'OK' as const
}
