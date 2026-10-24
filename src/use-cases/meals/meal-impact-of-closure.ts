import type { z } from 'zod'
import { isSchoolClosed } from '@/domain/school-closure'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { loadMealAccountSummaries, type MealClosure } from './meal-account-summaries'
import { mealImpactOfClosureSchema } from './schemas'

type Input = z.infer<typeof mealImpactOfClosureSchema>

/**
 * Impact repas d'une fermeture avant son enregistrement (R12) : les enfants qui mangent un
 * des jours fermés, et ceux dont le « payé jusqu'au » bouge. L'événement en cours d'édition
 * est retiré du calcul de référence, puis remplacé par sa version saisie, supposée publiée.
 */
export async function mealImpactOfClosure(
  input: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = mealImpactOfClosureSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, eventId, startAt, endAt, today } = parsed.data
  if (endAt && endAt < startAt) return 'validationError' as const
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const accounts = await accountGw.findActiveStudentAccounts(schoolId)
  const closure: MealClosure = { status: 'PUBLISHED', category: 'CLOSURE', startAt, endAt }
  const withoutEvent = (closures: MealClosure[]) => closures.filter((c) => c.id !== eventId)

  const [before, after] = await accountGw.transaction(async (tx) => [
    await loadMealAccountSummaries(
      tx,
      { schoolId, accounts, today, adjustClosures: withoutEvent },
      accountGw
    ),
    await loadMealAccountSummaries(
      tx,
      {
        schoolId,
        accounts,
        today,
        adjustClosures: (closures) => [...withoutEvent(closures), closure],
      },
      accountGw
    ),
  ])

  const children = new Set<string>()
  const moved = new Set<string>()
  for (const account of accounts) {
    const summary = before.get(account.id)
    if (!summary?.served.some((day) => isSchoolClosed([closure], new Date(`${day}T00:00:00.000Z`))))
      continue
    children.add(account.studentId)
    if (summary.coverage.paidThrough !== after.get(account.id)?.coverage.paidThrough) {
      moved.add(account.studentId)
    }
  }
  return { children: children.size, moved: moved.size }
}
