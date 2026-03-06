import { roundHalfUp } from '@/lib/decimal'

export type EnrollmentBalance = {
  enrollmentId: string
  remainingBalance: number
  totalAmount: number
  discount: number
}

type DistributionSuccess = {
  result: 'OK'
  distribution: Array<{ enrollmentId: string; amount: number }>
}

type DistributionError =
  | { result: 'overpayment' }
  | { result: 'noActiveEnrollments' }
  | { result: 'refundExceedsPaid' }

type DistributionResult = DistributionSuccess | DistributionError

export function distributePayment(
  amount: number,
  enrollments: EnrollmentBalance[]
): DistributionResult {
  if (enrollments.length === 0) {
    return { result: 'noActiveEnrollments' }
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
    paid: e.totalAmount - e.discount - e.remainingBalance,
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
