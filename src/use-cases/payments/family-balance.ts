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
  payableEnrollments: FamilyEnrollmentBalance[]
  totalAmount: number
  totalDiscount: number
  totalPaid: number
  remainingBalance: number
  payableBalance: number
  payableAmountInCents: number
}

export function calculateFamilyBalance(enrollments: BalanceEnrollment[]): FamilyBalance {
  const balances = enrollments.map((enrollment) => {
    const totalAmount = Number(enrollment.totalAmount)
    const discount = Number(enrollment.discount)
    const paidAmount = roundHalfUp(
      enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    )
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
    balances.reduce((sum, enrollment) => sum + enrollment.paidAmount, 0)
  )
  const remainingBalance = roundHalfUp(
    balances.reduce((sum, enrollment) => sum + enrollment.remainingBalance, 0)
  )

  const unpaid = balances.filter((enrollment) => enrollment.remainingBalance > 0)
  const payableEnrollments = unpaid.filter((enrollment) => enrollment.status === 'ACTIVE')
  const payableBalance = roundHalfUp(
    payableEnrollments.reduce((sum, enrollment) => sum + enrollment.remainingBalance, 0)
  )

  return {
    enrollments: unpaid,
    payableEnrollments,
    totalAmount,
    totalDiscount,
    totalPaid,
    remainingBalance,
    payableBalance,
    payableAmountInCents: Math.round(payableBalance * 100),
  }
}

export async function getFamilyBalance(familyId: string, periodId?: string | null) {
  const enrollments = await db.enrollment.findMany({
    where: {
      status: { in: ['PENDING', 'ACTIVE'] },
      student: {
        person: {
          families: {
            some: { familyId },
          },
        },
      },
      ...(periodId
        ? {
            classAssignments: {
              some: { classPeriod: { periodId } },
            },
          }
        : {}),
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
