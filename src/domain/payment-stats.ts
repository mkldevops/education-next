import { type DecimalLike, roundHalfUp, toNumber } from '@/lib/decimal'

export type StatsEnrollment = {
  totalAmount: DecimalLike
  /** Somme des paiements actifs de l'inscription, agrégée en base. */
  paid: DecimalLike | null
  family: { id: string; name: string } | null
}

export type MethodTotal = {
  method: string
  amount: DecimalLike | null
  count: number
}

export type UncashedCheques = {
  amount: DecimalLike | null
  count: number
}

export type DatedAmount = {
  amount: DecimalLike
  paidAt: Date
}

export type MonthWindow = {
  /** Premier instant du premier mois affiché, en UTC. */
  from: Date
  /** Premier instant du mois suivant le dernier mois affiché, exclu, en UTC. */
  to: Date
  months: number
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

function amountOf(value: DecimalLike | null): number {
  return value === null ? 0 : toNumber(value)
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
 * inscription. Un `cashedAt` ne concerne que les chèques : le reste est encaissé à la remise.
 */
export function summarizePayments(
  enrollments: StatsEnrollment[],
  methods: MethodTotal[],
  uncashed: UncashedCheques
): PaymentTotals {
  let due = 0
  let collected = 0
  let remaining = 0
  let settledCount = 0

  for (const enrollment of enrollments) {
    const total = toNumber(enrollment.totalAmount)
    const paid = roundHalfUp(amountOf(enrollment.paid))

    due += total
    collected += paid
    remaining += Math.max(0, roundHalfUp(total - paid))
    if (paid >= total) settledCount += 1
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
    paymentCount: methods.reduce((sum, method) => sum + method.count, 0),
    uncashedAmount: roundHalfUp(amountOf(uncashed.amount)),
    uncashedCount: uncashed.count,
  }
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
}

/** Premier instant, en UTC, du mois qui suit `date` : borne exclue du mois courant. */
export function nextMonthStart(date: Date): Date {
  return monthStart(date, 1)
}

/**
 * Fenêtre du graphique mensuel, en mois UTC comme les dates de paiement saisies.
 *
 * Elle se termine au mois du dernier paiement plutôt qu'au mois courant, sans jamais le dépasser :
 * une période scolaire passée resterait sinon affichée vide, et une date saisie dans le futur
 * étirerait le graphique au point d'écraser les mois utiles.
 */
export function monthWindow(
  latestPaidAt: Date | null,
  { months = 12, reference = new Date() }: { months?: number; reference?: Date } = {}
): MonthWindow {
  const cap = nextMonthStart(reference)
  const end = latestPaidAt && latestPaidAt < cap ? latestPaidAt : reference

  return { from: monthStart(end, 1 - months), to: nextMonthStart(end), months }
}

/** Série mensuelle des encaissements sur la fenêtre, mois vides compris. */
export function monthlyCollection(
  payments: DatedAmount[],
  window: MonthWindow
): MonthlyCollection[] {
  const buckets = new Map<string, { amount: number; count: number }>()

  for (const payment of payments) {
    if (payment.paidAt < window.from || payment.paidAt >= window.to) continue
    const key = monthKey(payment.paidAt)
    const bucket = buckets.get(key) ?? { amount: 0, count: 0 }
    bucket.amount += toNumber(payment.amount)
    bucket.count += 1
    buckets.set(key, bucket)
  }

  return Array.from({ length: window.months }, (_, index) => {
    const key = monthKey(monthStart(window.from, index))
    const bucket = buckets.get(key)
    return { month: key, amount: roundHalfUp(bucket?.amount ?? 0), count: bucket?.count ?? 0 }
  })
}

/** Répartition par mode de paiement, triée par montant décroissant. */
export function collectionByMethod(methods: MethodTotal[]): MethodCollection[] {
  const total = roundHalfUp(methods.reduce((sum, method) => sum + amountOf(method.amount), 0))

  return methods
    .map((method) => {
      const amount = amountOf(method.amount)
      return {
        method: method.method,
        amount: roundHalfUp(amount),
        count: method.count,
        share: total > 0 ? roundHalfUp((amount / total) * 100, 1) : 0,
      }
    })
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
    const paid = roundHalfUp(amountOf(enrollment.paid))
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
