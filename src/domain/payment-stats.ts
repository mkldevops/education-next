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
