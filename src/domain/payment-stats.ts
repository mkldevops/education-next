import { type DecimalLike, roundHalfUp, toNumber } from '@/lib/decimal'

export type StatsPayment = {
  amount: DecimalLike
  method: string
  paidAt: Date
  cashedAt: Date | null
}

export type StatsEnrollment = {
  totalAmount: DecimalLike
  family: { id: string; name: string } | null
  payments: StatsPayment[]
}

export type PaymentTotals = {
  due: number
  collected: number
  remaining: number
  collectionRate: number
  enrollmentCount: number
  settledCount: number
  outstandingCount: number
  paymentCount: number
  uncashedAmount: number
  uncashedCount: number
}

export type MonthlyCollection = {
  month: string
  amount: number
  count: number
}

export type MethodCollection = {
  method: string
  amount: number
  count: number
  share: number
}

export type FamilyOutstanding = {
  familyId: string
  familyName: string
  due: number
  paid: number
  remaining: number
  collectionRate: number
}

/** Un `cashedAt` ne concerne que les chèques : le reste est encaissé à la remise. */
const CHEQUE = 'CHECK'

function sumAmounts(payments: StatsPayment[]): number {
  return roundHalfUp(payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0))
}

function rate(collected: number, due: number): number {
  if (due <= 0) return collected > 0 ? 100 : 0
  return Math.min(100, roundHalfUp((collected / due) * 100, 1))
}

/**
 * Totaux d'encaissement d'un ensemble d'inscriptions.
 *
 * Le dû est `totalAmount`, déjà net de remise. Le restant est plafonné à zéro par inscription,
 * comme `calculateFamilyBalance` : un trop-perçu isolé ne doit pas effacer la dette d'une autre
 * inscription.
 */
export function summarizePayments(enrollments: StatsEnrollment[]): PaymentTotals {
  let due = 0
  let collected = 0
  let remaining = 0
  let settledCount = 0
  let paymentCount = 0
  let uncashedAmount = 0
  let uncashedCount = 0

  for (const enrollment of enrollments) {
    const total = toNumber(enrollment.totalAmount)
    const paid = sumAmounts(enrollment.payments)

    due += total
    collected += paid
    remaining += Math.max(0, roundHalfUp(total - paid))
    if (paid >= total) settledCount += 1

    for (const payment of enrollment.payments) {
      paymentCount += 1
      if (payment.method === CHEQUE && payment.cashedAt === null) {
        uncashedAmount += toNumber(payment.amount)
        uncashedCount += 1
      }
    }
  }

  due = roundHalfUp(due)
  collected = roundHalfUp(collected)
  remaining = roundHalfUp(remaining)

  return {
    due,
    collected,
    remaining,
    collectionRate: rate(roundHalfUp(due - remaining), due),
    enrollmentCount: enrollments.length,
    settledCount,
    outstandingCount: enrollments.length - settledCount,
    paymentCount,
    uncashedAmount: roundHalfUp(uncashedAmount),
    uncashedCount,
  }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Série mensuelle des encaissements, mois vides compris.
 *
 * La fenêtre se termine au mois du dernier paiement plutôt qu'au mois courant : une période
 * scolaire passée resterait sinon affichée vide.
 */
export function monthlyCollection(
  payments: StatsPayment[],
  { months = 12, reference = new Date() }: { months?: number; reference?: Date } = {}
): MonthlyCollection[] {
  const buckets = new Map<string, MonthlyCollection>()
  let latest: Date | null = null

  for (const payment of payments) {
    const key = monthKey(payment.paidAt)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.amount += toNumber(payment.amount)
      bucket.count += 1
    } else {
      buckets.set(key, { month: key, amount: toNumber(payment.amount), count: 1 })
    }
    if (!latest || payment.paidAt > latest) latest = payment.paidAt
  }

  const end = latest ?? reference
  const series: MonthlyCollection[] = []

  for (let offset = months - 1; offset >= 0; offset--) {
    const key = monthKey(new Date(end.getFullYear(), end.getMonth() - offset, 1))
    const bucket = buckets.get(key)
    series.push({ month: key, amount: roundHalfUp(bucket?.amount ?? 0), count: bucket?.count ?? 0 })
  }

  return series
}

/** Répartition par mode de paiement, triée par montant décroissant. */
export function collectionByMethod(payments: StatsPayment[]): MethodCollection[] {
  const buckets = new Map<string, { amount: number; count: number }>()

  for (const payment of payments) {
    const bucket = buckets.get(payment.method) ?? { amount: 0, count: 0 }
    bucket.amount += toNumber(payment.amount)
    bucket.count += 1
    buckets.set(payment.method, bucket)
  }

  const total = roundHalfUp([...buckets.values()].reduce((sum, bucket) => sum + bucket.amount, 0))

  return [...buckets.entries()]
    .map(([method, bucket]) => ({
      method,
      amount: roundHalfUp(bucket.amount),
      count: bucket.count,
      share: total > 0 ? roundHalfUp((bucket.amount / total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method))
}

/**
 * Familles ayant encore un reste à payer, de la plus endettée à la moins endettée.
 *
 * Une inscription sans famille rattachée est ignorée : elle n'est réclamable à personne.
 */
export function familiesOutstanding(
  enrollments: StatsEnrollment[],
  limit?: number
): FamilyOutstanding[] {
  const buckets = new Map<string, FamilyOutstanding>()

  for (const enrollment of enrollments) {
    if (!enrollment.family) continue

    const total = toNumber(enrollment.totalAmount)
    const paid = sumAmounts(enrollment.payments)
    const bucket = buckets.get(enrollment.family.id) ?? {
      familyId: enrollment.family.id,
      familyName: enrollment.family.name,
      due: 0,
      paid: 0,
      remaining: 0,
      collectionRate: 0,
    }

    bucket.due += total
    bucket.paid += paid
    bucket.remaining += Math.max(0, roundHalfUp(total - paid))
    buckets.set(enrollment.family.id, bucket)
  }

  const families = [...buckets.values()]
    .map((bucket) => {
      const due = roundHalfUp(bucket.due)
      const remaining = roundHalfUp(bucket.remaining)

      return {
        ...bucket,
        due,
        paid: roundHalfUp(bucket.paid),
        remaining,
        collectionRate: rate(roundHalfUp(due - remaining), due),
      }
    })
    .filter((family) => family.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.familyName.localeCompare(b.familyName))

  return limit === undefined ? families : families.slice(0, limit)
}
