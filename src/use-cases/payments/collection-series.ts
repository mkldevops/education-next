import {
  type ChartView,
  type CollectionPoint,
  collectionSeries,
  collectionWindow,
} from '@/domain/collection-chart'
import { schoolToday } from '@/domain/school-date'
import { db } from '@/lib/db'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { paymentScope } from './payment-stats'

const DAY_MS = 86_400_000

function localDay(instant: Date, timeZone: string): Date {
  return new Date(`${schoolToday(timeZone, instant)}T00:00:00.000Z`)
}

/**
 * Encaissements de l'école sur la vue choisie : l'écolage, au périmètre de `getPaymentStats`, et
 * les lignes repas (cantine et goûter, élèves et personnel) et garderie des reçus non annulés. Un
 * reçu compte le jour local de l'école où il a été payé ; ces lignes ne dépendent pas de la
 * période scolaire. Seules les lignes de la fenêtre sont lues, pour que le coût ne croisse pas avec
 * l'historique.
 */
export async function getCollectionSeries(
  schoolId: string,
  periodId: string | null,
  view: ChartView,
  reference: Date = new Date()
): Promise<CollectionPoint[]> {
  const { paymentWhere } = paymentScope(schoolId, periodId)
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const tomorrow = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + 1)
  )
  const receiptWhere = {
    schoolId,
    cancelledAt: null,
    OR: [{ mealPayments: { some: {} } }, { childcarePayments: { some: {} } }],
  }
  const [latestPayment, latestReceipt] = await Promise.all([
    db.payment.aggregate({
      where: { ...paymentWhere, paidAt: { lt: tomorrow } },
      _max: { paidAt: true },
    }),
    db.receipt.aggregate({
      where: { ...receiptWhere, paidAt: { lt: new Date(tomorrow.getTime() + DAY_MS) } },
      _max: { paidAt: true },
    }),
  ])
  const receiptDay = latestReceipt._max.paidAt
    ? localDay(latestReceipt._max.paidAt, timeZone)
    : null
  const paymentDay = latestPayment._max.paidAt
  const latest =
    paymentDay && receiptDay
      ? new Date(Math.max(paymentDay.getTime(), receiptDay.getTime()))
      : (paymentDay ?? receiptDay)
  const window = collectionWindow(latest, view, reference)
  const receiptPaidAt = {
    gte: new Date(window.from.getTime() - DAY_MS),
    lt: new Date(window.to.getTime() + DAY_MS),
  }
  const lineWhere = { schoolId, receipt: { cancelledAt: null, paidAt: receiptPaidAt } }
  const lineSelect = { amount: true, receipt: { select: { paidAt: true } } } as const

  const [payments, mealLines, childcareLines] = await Promise.all([
    db.payment.findMany({
      where: { ...paymentWhere, paidAt: { gte: window.from, lt: window.to } },
      select: { amount: true, paidAt: true },
    }),
    db.mealPayment.findMany({ where: lineWhere, select: lineSelect }),
    db.childcarePayment.findMany({ where: lineWhere, select: lineSelect }),
  ])
  const receiptLines = [...mealLines, ...childcareLines].map((line) => ({
    amount: line.amount,
    paidAt: localDay(line.receipt.paidAt, timeZone),
  }))

  return collectionSeries([...payments, ...receiptLines], window)
}
