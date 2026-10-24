import type { z } from 'zod'
import { validateMealWeekdays } from '@/domain/meal-ledger'
import { overlapsAny, validateSegmentDates } from '@/domain/meal-schedule'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { subscribeMealSchema } from './schemas'

type Input = z.infer<typeof subscribeMealSchema>

/** Ouvre un segment de jours servis dans une période, à toute date de cette période. */
export async function subscribeMeal(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = subscribeMealSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, studentId, service, periodId, weekdays, startOn } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const setting = await accountGw.findSetting(schoolId, service)
  if (!setting?.isEnabled) return 'serviceDisabled' as const

  const days = validateMealWeekdays(weekdays, setting.allowedWeekdays)
  if (days !== 'OK') return days

  if (!(await accountGw.isActiveStudent(schoolId, studentId))) return 'notFound' as const
  const period = await accountGw.findPeriod(schoolId, periodId)
  if (!period) return 'notFound' as const

  const dates = validateSegmentDates({
    startOn,
    endOn: null,
    periodStart: period.start,
    periodEnd: period.end,
  })
  if (dates !== 'OK') return dates

  return accountGw.transaction(async (tx) => {
    const accountId = await accountGw.lockAccount(tx, schoolId, studentId, service, true)
    if (!accountId) return 'notFound' as const

    const segments = await accountGw.listSegments(tx, schoolId, [accountId], [periodId])
    if (overlapsAny(segments, { startOn, endOn: null })) return 'alreadySubscribed' as const

    await accountGw.createSegment(tx, schoolId, {
      accountId,
      periodId,
      weekdays: [...weekdays].sort((a, b) => a - b),
      startOn,
      endOn: null,
    })
    return 'OK' as const
  })
}
