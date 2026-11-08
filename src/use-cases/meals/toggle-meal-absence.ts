import type { z } from 'zod'
import { servedDays } from '@/domain/meal-ledger'
import { mealOwner } from '@/domain/meal-owner'
import { isSchoolClosed } from '@/domain/school-closure'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { toggleMealAbsenceSchema } from './schemas'

type Input = z.infer<typeof toggleMealAbsenceSchema>

/**
 * Marque ou retire l'absence d'un jour servi (R7). Toujours créditée, sans délai ni plafond :
 * le jour n'est pas consommé et la couverture glisse d'un jour servi.
 */
export async function toggleMealAbsence(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = toggleMealAbsenceSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, service, day, absent, recordedById } = parsed.data
  const owner = mealOwner(parsed.data)
  if (!owner) return 'validationError' as const
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  return accountGw.transaction(async (tx) => {
    const accountId = await accountGw.lockAccount(tx, schoolId, owner, service, false)
    if (!accountId) return 'notSubscribed' as const

    if (!absent) {
      await accountGw.removeAbsence(tx, schoolId, accountId, day)
      return 'OK' as const
    }

    const segments = await accountGw.listSegments(tx, schoolId, [accountId])
    const closures = await accountGw.findClosures(schoolId, day, day)
    const served = servedDays({
      segments: segments.map((segment) => ({
        ...segment,
        endOn: segment.endOn ?? segment.periodEnd,
      })),
      periodEnd: day,
      isClosed: (d) => isSchoolClosed(closures, new Date(`${d}T00:00:00.000Z`)),
    })
    if (!served.includes(day)) return 'notServed' as const

    await accountGw.addAbsence(tx, schoolId, { accountId, day, recordedById })
    return 'OK' as const
  })
}
