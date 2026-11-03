import type { z } from 'zod'
import { validateMealWeekdays } from '@/domain/meal-ledger'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffMealGateway } from '@/gateways/staff-meal-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { setStaffMealSchema } from './schemas'

type Input = z.infer<typeof setStaffMealSchema>

/**
 * Inscrit un membre du personnel à un service, ou remplace ses jours (#545). Rien n'est
 * facturé : la ligne ne sert qu'à compter les repas du jour.
 */
export async function setStaffMeal(
  input: Input,
  staffGw = staffMealGateway,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = setStaffMealSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, teacherId, service, isFree } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const setting = await accountGw.findSetting(schoolId, service)
  if (!setting?.isEnabled) return 'serviceDisabled' as const

  const weekdays = [...parsed.data.weekdays].sort((a, b) => a - b)
  const days = validateMealWeekdays(weekdays, setting.allowedWeekdays)
  if (days !== 'OK') return days

  if (!(await staffGw.isActiveTeacher(schoolId, teacherId))) return 'notFound' as const

  await staffGw.upsert(schoolId, teacherId, service, { weekdays, isFree })
  return 'OK' as const
}
