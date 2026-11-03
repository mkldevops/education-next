import type { z } from 'zod'
import { validateMealWeekdays } from '@/domain/meal-ledger'
import { mealOwner } from '@/domain/meal-owner'
import { planStop, segmentFrom } from '@/domain/meal-schedule'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { changeMealScheduleSchema } from './schemas'

type Input = z.infer<typeof changeMealScheduleSchema>

/**
 * Nouveaux jours à partir de `effectiveFrom` : le segment en cours se ferme la veille et un
 * segment le prolonge jusqu'à la même fin. Les jours déjà servis ne changent pas (R6).
 */
export async function changeMealSchedule(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway,
  now = new Date()
) {
  const parsed = changeMealScheduleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, service, weekdays, effectiveFrom } = parsed.data
  const owner = mealOwner(parsed.data)
  if (!owner) return 'validationError' as const
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const setting = await accountGw.findSetting(schoolId, service)
  if (!setting?.isEnabled) return 'serviceDisabled' as const

  const days = validateMealWeekdays(weekdays, setting.allowedWeekdays)
  if (days !== 'OK') return days

  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  if (effectiveFrom < schoolToday(timeZone, now)) return 'backdated' as const

  return accountGw.transaction(async (tx) => {
    const accountId = await accountGw.lockAccount(tx, schoolId, owner, service, false)
    if (!accountId) return 'notSubscribed' as const

    const segments = await accountGw.listSegments(tx, schoolId, [accountId])
    const current = segmentFrom(segments, effectiveFrom)
    if (!current) return 'notSubscribed' as const

    const startOn = current.startOn > effectiveFrom ? current.startOn : effectiveFrom
    await accountGw.applyStop(tx, schoolId, planStop([current], startOn))
    await accountGw.createSegment(tx, schoolId, {
      accountId,
      periodId: current.periodId,
      weekdays: [...weekdays].sort((a, b) => a - b),
      startOn,
      endOn: current.endOn,
    })
    return 'OK' as const
  })
}
