import type { z } from 'zod'
import { validateMealWeekdays } from '@/domain/meal-ledger'
import { configGateway } from '@/gateways/config-gateway'
import { mealGateway } from '@/gateways/meal-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { setMealServiceSettingSchema } from './schemas'

type Input = z.infer<typeof setMealServiceSettingSchema>

export async function setMealServiceSetting(
  input: Input,
  mealGw = mealGateway,
  configGw = configGateway
) {
  const parsed = setMealServiceSettingSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, service, isEnabled } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const allowedWeekdays = [...parsed.data.allowedWeekdays].sort((a, b) => a - b)
  const weekdays = validateMealWeekdays(allowedWeekdays)
  if (weekdays !== 'OK') return weekdays

  await mealGw.upsertSetting(schoolId, service, { isEnabled, allowedWeekdays })
  return 'OK' as const
}
