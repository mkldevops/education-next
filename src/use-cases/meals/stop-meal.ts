import type { z } from 'zod'
import { planStop } from '@/domain/meal-schedule'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { stopMealSchema } from './schemas'

type Input = z.infer<typeof stopMealSchema>

/** Plus aucun jour servi à partir de `effectiveFrom` inclus. Le passé reste dû ou payé. */
export async function stopMeal(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = stopMealSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, studentId, service, effectiveFrom } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  if (effectiveFrom < schoolToday(timeZone, now)) return 'backdated' as const

  return accountGw.transaction(async (tx) => {
    const accountId = await accountGw.lockAccount(tx, schoolId, studentId, service, false)
    if (!accountId) return 'notSubscribed' as const

    const plan = planStop(await accountGw.listSegments(tx, schoolId, [accountId]), effectiveFrom)
    if (plan.removed.length === 0 && plan.closed.length === 0) return 'notSubscribed' as const

    await accountGw.applyStop(tx, schoolId, plan)
    return 'OK' as const
  })
}
