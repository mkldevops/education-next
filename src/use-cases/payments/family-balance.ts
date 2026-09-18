import { resolveDebtorFamily } from '@/domain/family-debtor'
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
  const rows = await db.enrollment.findMany({
    where: {
      schoolId,
      status: { in: ['PENDING', 'ACTIVE'] },
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
      student: {
        select: {
          person: {
            select: {
              families: { select: { familyId: true, relationType: true } },
            },
          },
        },
      },
    },
  })

  const enrollments = rows
    .filter((row) => resolveDebtorFamily(row.student.person.families)?.familyId === familyId)
    .map(({ student: _student, ...enrollment }) => enrollment)

  return calculateFamilyBalance(enrollments)
}
