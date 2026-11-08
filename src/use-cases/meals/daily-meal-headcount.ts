import type { z } from 'zod'
import { type MealHeadcount, mealHeadcount } from '@/domain/meal-headcount'
import { isSchoolClosed } from '@/domain/school-closure'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { MealService } from '@/generated/prisma/enums'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { dailyMealHeadcountSchema } from './schemas'

type Input = z.infer<typeof dailyMealHeadcountSchema>

/** Repas servis un jour, par service : élèves et personnel comptés à part (#545). */
export async function dailyMealHeadcount(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = dailyMealHeadcountSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, day } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const closures = await accountGw.findClosures(schoolId, day, day)
  const isClosed = isSchoolClosed(closures, new Date(`${day}T00:00:00.000Z`))

  const counts = {} as Record<MealService, MealHeadcount>
  for (const service of Object.values(MealService)) {
    const { segments, absentAccountIds } = await accountGw.listDay(schoolId, service, day)
    counts[service] = mealHeadcount({ day, isClosed, segments, absentAccountIds })
  }
  return counts
}
