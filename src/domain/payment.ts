import { roundHalfUp } from '@/lib/decimal'

export type EnrollmentBalance = {
  enrollmentId: string
  remainingBalance: number
  totalAmount: number
  discount: number
}

type PayableEnrollment = {
  id: string
  totalAmount: number | { toString(): string }
  discount: number | { toString(): string }
  payments: Array<{ amount: number | { toString(): string } }>
}

export function enrollmentBalances(enrollments: PayableEnrollment[]): EnrollmentBalance[] {
  return enrollments.map((enrollment) => {
    const totalAmount = Number(enrollment.totalAmount)
    const paid = roundHalfUp(
      enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    )
    return {
      enrollmentId: enrollment.id,
      totalAmount,
      discount: Number(enrollment.discount),
      remainingBalance: Math.max(0, roundHalfUp(totalAmount - paid)),
    }
  })
}

type DistributionSuccess = {
  result: 'OK'
  distribution: Array<{ enrollmentId: string; amount: number }>
}

type DistributionError =
  | { result: 'overpayment' }
  | { result: 'noPayableEnrollments' }
  | { result: 'refundExceedsPaid' }

type DistributionResult = DistributionSuccess | DistributionError

export function distributePayment(
  amount: number,
  enrollments: EnrollmentBalance[]
): DistributionResult {
  if (enrollments.length === 0) {
    return { result: 'noPayableEnrollments' }
  }

  if (amount > 0) {
    return distributePositivePayment(amount, enrollments)
  } else if (amount < 0) {
    return distributeRefund(-amount, enrollments)
  } else {
    return { result: 'OK', distribution: [] }
  }
}

function distributePositivePayment(
  amount: number,
  enrollments: EnrollmentBalance[]
): DistributionResult {
  const totalRemaining = enrollments.reduce((sum, e) => sum + e.remainingBalance, 0)

  if (totalRemaining < amount) {
    return { result: 'overpayment' }
  }

  const parts = splitInWholeUnits(
    amount,
    enrollments.map((e) => e.remainingBalance)
  )

  return {
    result: 'OK',
    distribution: enrollments.map((e, i) => ({ enrollmentId: e.enrollmentId, amount: parts[i] })),
  }
}

function distributeRefund(
  refundAmount: number,
  enrollments: EnrollmentBalance[]
): DistributionResult {
  const paid = enrollments.map((e) => e.totalAmount - e.remainingBalance)
  const totalPaid = paid.reduce((sum, p) => sum + p, 0)

  if (refundAmount > totalPaid) {
    return { result: 'refundExceedsPaid' }
  }

  const parts = splitInWholeUnits(refundAmount, paid)

  return {
    result: 'OK',
    distribution: enrollments.map((e, i) => ({ enrollmentId: e.enrollmentId, amount: -parts[i] })),
  }
}

/**
 * Chaque part est un nombre entier d'euros, au prorata de la capacité de chaque inscription.
 *
 * Les parts sont arrondies à l'entier inférieur, puis l'euro restant va aux premières
 * inscriptions, une à une : 100 sur trois soldes égaux donne 34 + 33 + 33. Aucune part ne
 * dépasse sa capacité, et seuls les centimes d'une somme non entière restent fractionnaires.
 */
function splitInWholeUnits(amount: number, capacities: number[]): number[] {
  const total = capacities.reduce((sum, c) => sum + c, 0)
  const parts = capacities.map((capacity) =>
    total > 0 ? Math.min(Math.floor(roundHalfUp((capacity / total) * amount, 6)), capacity) : 0
  )

  let leftover = roundHalfUp(amount - parts.reduce((sum, p) => sum + p, 0))
  while (leftover > 0) {
    let moved = false
    for (let i = 0; i < parts.length && leftover > 0; i++) {
      const step = roundHalfUp(Math.min(1, leftover, capacities[i] - parts[i]))
      if (step <= 0) continue
      parts[i] = roundHalfUp(parts[i] + step)
      leftover = roundHalfUp(leftover - step)
      moved = true
    }
    if (!moved) break
  }

  return parts
}

type GroupablePayment = {
  id: string
  familyId: string
  enrollmentId: string
  amount: number | { toString(): string }
  method: string
  reference: string | null
  paidAt: Date
  cashedAt: Date | null
  paymentTransactionId: string | null
  createdAt: Date
}

export type FamilyPayment<T extends GroupablePayment> = {
  id: string
  familyId: string
  amount: number
  method: T['method']
  reference: string | null
  paidAt: Date
  cashedAt: Date | null
  lines: T[]
}

const SAME_PAYMENT_WINDOW_MS = 5_000

function paymentKey(payment: GroupablePayment): string {
  return [
    payment.familyId,
    payment.method,
    payment.reference ?? '',
    payment.paidAt.getTime(),
    payment.cashedAt?.getTime() ?? '',
    payment.paymentTransactionId ?? '',
  ].join('|')
}

/**
 * Une famille paie une somme, la base la ventile en une ligne par inscription. Ce regroupement
 * rend la somme versée : mêmes famille, mode, référence, dates et transaction, écrites ensemble
 * et sans deux lignes sur la même inscription.
 */
export function groupFamilyPayments<T extends GroupablePayment>(
  payments: T[]
): Array<FamilyPayment<T>> {
  const groups: Array<FamilyPayment<T> & { key: string; lastCreatedAt: number }> = []
  const latestByKey = new Map<string, (typeof groups)[number]>()
  const byCreation = [...payments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  for (const payment of byCreation) {
    const key = paymentKey(payment)
    const createdAt = payment.createdAt.getTime()
    const latest = latestByKey.get(key)
    const group =
      latest &&
      createdAt - latest.lastCreatedAt <= SAME_PAYMENT_WINDOW_MS &&
      !latest.lines.some((line) => line.enrollmentId === payment.enrollmentId)
        ? latest
        : undefined

    if (group) {
      group.lines.push(payment)
      group.amount = roundHalfUp(group.amount + Number(payment.amount))
      group.lastCreatedAt = createdAt
      continue
    }

    const created = {
      key,
      lastCreatedAt: createdAt,
      id: payment.id,
      familyId: payment.familyId,
      amount: roundHalfUp(Number(payment.amount)),
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      cashedAt: payment.cashedAt,
      lines: [payment],
    }
    groups.push(created)
    latestByKey.set(key, created)
  }

  return groups
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime() || b.lastCreatedAt - a.lastCreatedAt)
    .map(({ key: _key, lastCreatedAt: _lastCreatedAt, ...group }) => group)
}
