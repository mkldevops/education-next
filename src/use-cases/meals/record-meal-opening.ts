import type { z } from 'zod'
import { servedDays, servedDaysThrough } from '@/domain/meal-ledger'
import { mealOwner } from '@/domain/meal-owner'
import { isSchoolClosed } from '@/domain/school-closure'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { recordMealOpeningSchema } from './schemas'

type Input = z.infer<typeof recordMealOpeningSchema>

/**
 * Reprise (R10) : « déjà payé jusqu'au » devient un nombre de jours servis, compté sur les
 * segments et les fermetures connus aujourd'hui. Une seule reprise par compte.
 */
export async function recordMealOpening(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = recordMealOpeningSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, service, paidThrough, reason, recordedById } = parsed.data
  const owner = mealOwner(parsed.data)
  if (!owner) return 'validationError' as const
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  return accountGw.transaction(async (tx) => {
    const accountId = await accountGw.lockAccount(tx, schoolId, owner, service, false)
    if (!accountId) return 'notSubscribed' as const

    const segments = await accountGw.listSegments(tx, schoolId, [accountId])
    const first = segments[0]
    if (!first) return 'notSubscribed' as const

    const closures = await accountGw.findClosures(schoolId, first.startOn, paidThrough)
    const served = servedDays({
      segments: segments.map((segment) => ({
        ...segment,
        endOn: segment.endOn ?? segment.periodEnd,
      })),
      periodEnd: paidThrough,
      isClosed: (day) => isSchoolClosed(closures, new Date(`${day}T00:00:00.000Z`)),
    })

    await accountGw.replaceOpening(tx, schoolId, {
      accountId,
      days: servedDaysThrough(served, paidThrough),
      reason,
      recordedById,
    })
    return 'OK' as const
  })
}
