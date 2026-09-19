import type { EnrollmentStatus } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'

type BalanceEnrollment = {
  id: string
  status: EnrollmentStatus
  totalAmount: number | { toString(): string }
  discount: number | { toString(): string }
  payments: Array<{ amount: number | { toString(): string } }>
}

type FamilyEnrollmentBalance = {
  enrollmentId: string
  status: EnrollmentStatus
  totalAmount: number
  discount: number
  paidAmount: number
  remainingBalance: number
}

export type FamilyBalance = {
  enrollments: FamilyEnrollmentBalance[]
  totalAmount: number
  totalDiscount: number
  totalPaid: number
  remainingBalance: number
  remainingAmountInCents: number
}

/** Only these enrollments still owe money; the others only contribute what was already paid. */
export const PAYABLE_ENROLLMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
] as const satisfies EnrollmentStatus[]

export function isPayableEnrollment(status: EnrollmentStatus) {
  return (PAYABLE_ENROLLMENT_STATUSES as readonly EnrollmentStatus[]).includes(status)
}

function sumPayments(enrollment: BalanceEnrollment) {
  return roundHalfUp(enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0))
}

/**
 * Money received stays received: payments recorded on a cancelled or completed enrollment still
 * count in `totalPaid`, but such an enrollment neither owes an amount nor receives an allocation.
 */
export function calculateFamilyBalance(allEnrollments: BalanceEnrollment[]): FamilyBalance {
  const enrollments = allEnrollments.filter((enrollment) => isPayableEnrollment(enrollment.status))
  const settledPaid = allEnrollments
    .filter((enrollment) => !isPayableEnrollment(enrollment.status))
    .reduce((sum, enrollment) => sum + sumPayments(enrollment), 0)

  const balances = enrollments.map((enrollment) => {
    const totalAmount = Number(enrollment.totalAmount)
    const discount = Number(enrollment.discount)
    const paidAmount = sumPayments(enrollment)
    const remainingBalance = Math.max(0, roundHalfUp(totalAmount - paidAmount))

    return {
      enrollmentId: enrollment.id,
      status: enrollment.status,
      totalAmount,
      discount,
      paidAmount,
      remainingBalance,
    }
  })

  const totalAmount = roundHalfUp(
    balances.reduce((sum, enrollment) => sum + enrollment.totalAmount, 0)
  )
  const totalDiscount = roundHalfUp(
    balances.reduce((sum, enrollment) => sum + enrollment.discount, 0)
  )
  const totalPaid = roundHalfUp(
    balances.reduce((sum, enrollment) => sum + enrollment.paidAmount, settledPaid)
  )
  const remainingBalance = roundHalfUp(
    balances.reduce((sum, enrollment) => sum + enrollment.remainingBalance, 0)
  )

  return {
    enrollments: balances.filter((enrollment) => enrollment.remainingBalance > 0),
    totalAmount,
    totalDiscount,
    totalPaid,
    remainingBalance,
    remainingAmountInCents: Math.round(remainingBalance * 100),
  }
}

export async function getFamilyBalance(schoolId: string, familyId: string) {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId,
      OR: [
        { status: { in: [...PAYABLE_ENROLLMENT_STATUSES] } },
        { payments: { some: { isActive: true } } },
      ],
      student: {
        person: {
          families: {
            some: { familyId },
          },
        },
      },
    },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      discount: true,
      payments: {
        where: { isActive: true },
        select: { amount: true },
      },
    },
  })

  return calculateFamilyBalance(enrollments)
}
