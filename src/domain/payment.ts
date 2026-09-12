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

  const distribution: Array<{ enrollmentId: string; amount: number }> = []
  let totalDistributed = 0

  for (let i = 0; i < enrollments.length; i++) {
    const enrollment = enrollments[i]
    const isLast = i === enrollments.length - 1

    let part: number
    if (isLast) {
      part = amount - totalDistributed
    } else {
      const proportion = (enrollment.remainingBalance / totalRemaining) * amount
      part = roundHalfUp(proportion)
      part = Math.min(part, enrollment.remainingBalance)
    }

    distribution.push({
      enrollmentId: enrollment.enrollmentId,
      amount: part,
    })
    totalDistributed += part
  }

  return {
    result: 'OK',
    distribution,
  }
}

function distributeRefund(
  refundAmount: number,
  enrollments: EnrollmentBalance[]
): DistributionResult {
  const enrollmentsWithPaid = enrollments.map((e) => ({
    ...e,
    paid: e.totalAmount - e.remainingBalance,
  }))

  const totalPaid = enrollmentsWithPaid.reduce((sum, e) => sum + e.paid, 0)

  if (refundAmount > totalPaid) {
    return { result: 'refundExceedsPaid' }
  }

  const distribution: Array<{ enrollmentId: string; amount: number }> = []
  let totalDistributed = 0

  for (let i = 0; i < enrollmentsWithPaid.length; i++) {
    const enrollment = enrollmentsWithPaid[i]
    const isLast = i === enrollmentsWithPaid.length - 1

    let part: number
    if (isLast) {
      part = refundAmount - totalDistributed
    } else {
      const proportion = (enrollment.paid / totalPaid) * refundAmount
      part = roundHalfUp(proportion)
      part = Math.min(part, enrollment.paid)
    }

    distribution.push({
      enrollmentId: enrollment.enrollmentId,
      amount: -part,
    })
    totalDistributed += part
  }

  return {
    result: 'OK',
    distribution,
  }
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
