import { type MealAccountSummary, summarizeMealAccount } from '@/domain/meal-account-summary'
import { isSchoolClosed } from '@/domain/school-closure'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import type { MealService, Prisma } from '@/generated/prisma/client'

/**
 * Fiches de plusieurs comptes au jour `today`, lues par `tx`. La caisse les affiche puis
 * les relit sous verrou à l'encaissement : un même calcul des deux côtés, pour que l'aperçu
 * et le reçu tombent sur le même « payé jusqu'au ».
 */
export async function loadMealAccountSummaries(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string
    accounts: ReadonlyArray<{ id: string; service: MealService }>
    today: string
  },
  accountGw = mealAccountGateway
): Promise<Map<string, MealAccountSummary>> {
  const { schoolId, accounts, today } = input
  const summaries = new Map<string, MealAccountSummary>()
  if (accounts.length === 0) return summaries

  const ids = accounts.map((account) => account.id)
  const segments = await accountGw.listSegments(tx, schoolId, ids)
  const { adjustments, payments } = await accountGw.listLedgers(tx, schoolId, ids)
  const prices = await accountGw.listPrices(tx, schoolId)
  const absences = await accountGw.listAbsences(tx, schoolId, ids)
  const closures =
    segments.length > 0
      ? await accountGw.findClosures(
          schoolId,
          segments.reduce((first, s) => (s.startOn < first ? s.startOn : first), today),
          segments.reduce((last, s) => (s.periodEnd > last ? s.periodEnd : last), today)
        )
      : []
  const isClosed = (day: string) => isSchoolClosed(closures, new Date(`${day}T00:00:00.000Z`))

  for (const account of accounts) {
    summaries.set(
      account.id,
      summarizeMealAccount({
        segments: segments.filter((segment) => segment.accountId === account.id),
        adjustments: adjustments.filter((adjustment) => adjustment.accountId === account.id),
        payments: payments.filter((payment) => payment.accountId === account.id),
        prices: prices.filter((price) => price.service === account.service),
        isClosed,
        absences: absences
          .filter((absence) => absence.accountId === account.id)
          .map((absence) => absence.day),
        today,
      })
    )
  }
  return summaries
}
