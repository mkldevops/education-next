import type { z } from 'zod'
import { validateMealPriceDate } from '@/domain/meal-price'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealGateway } from '@/gateways/meal-gateway'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { setMealPriceSchema } from './schemas'

type Input = z.infer<typeof setMealPriceSchema>

export async function setMealPrice(
  input: Input,
  mealGw = mealGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = setMealPriceSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, service, amount, effectiveFrom } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  if (!fitsCurrencyPrecision(amount, currency)) return 'validationError' as const

  const date = validateMealPriceDate({
    effectiveFrom,
    today: schoolToday(timeZone, now),
    hasPrice: (await mealGw.countPrices(schoolId, service)) > 0,
  })
  if (date !== 'OK') return date

  await mealGw.upsertPrice(schoolId, service, amount, effectiveFrom)
  return 'OK' as const
}
