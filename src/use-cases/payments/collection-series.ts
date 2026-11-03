import {
  type ChartView,
  type CollectionPoint,
  collectionSeries,
  collectionWindow,
} from '@/domain/collection-chart'
import { db } from '@/lib/db'
import { paymentScope } from './payment-stats'

/**
 * Encaissements de l'école sur la vue choisie, même périmètre que `getPaymentStats`. Seules les
 * lignes de la fenêtre sont lues, pour que le coût ne croisse pas avec l'historique.
 */
export async function getCollectionSeries(
  schoolId: string,
  periodId: string | null,
  view: ChartView,
  reference: Date = new Date()
): Promise<CollectionPoint[]> {
  const { paymentWhere } = paymentScope(schoolId, periodId)
  const tomorrow = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + 1)
  )
  const latest = await db.payment.aggregate({
    where: { ...paymentWhere, paidAt: { lt: tomorrow } },
    _max: { paidAt: true },
  })
  const window = collectionWindow(latest._max.paidAt, view, reference)
  const payments = await db.payment.findMany({
    where: { ...paymentWhere, paidAt: { gte: window.from, lt: window.to } },
    select: { amount: true, paidAt: true },
  })

  return collectionSeries(payments, window)
}
