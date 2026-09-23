import { type FamilyLink, resolveDebtorFamily } from '@/domain/family-debtor'
import type { EnrollmentStatus, Prisma } from '@/generated/prisma/client'
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
  /**
   * Toutes les inscriptions ventilables (statut payable), y compris celles déjà soldées.
   * Sert de filet pour un encaissement Stripe déjà débité quand `enrollments` est devenu
   * vide ou insuffisant entre la création de la session et le webhook (#306).
   */
  payableEnrollments: FamilyEnrollmentBalance[]
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
    payableEnrollments: balances,
    totalAmount,
    totalDiscount,
    totalPaid,
    remainingBalance,
    remainingAmountInCents: Math.round(remainingBalance * 100),
  }
}

export async function getFamilyBalance(
  schoolId: string,
  familyId: string,
  client: Prisma.TransactionClient = db
) {
  const rows = await client.enrollment.findMany({
    where: {
      schoolId,
      OR: [
        { status: { in: [...PAYABLE_ENROLLMENT_STATUSES] } },
        { payments: { some: { isActive: true } } },
      ],
      ...familyStudentFilter(familyId),
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
      student: debtorFamilySelect,
    },
  })

  const enrollments = rows
    .filter((row) => isDebtor(row, familyId))
    .map(({ student: _student, ...enrollment }) => enrollment)

  return calculateFamilyBalance(enrollments)
}

/**
 * Dernier recours du webhook Stripe : la carte est débitée mais plus aucune inscription de la
 * famille n'est au statut payable (annulée ou terminée pendant le checkout). L'argent reçu reste
 * reçu : il est porté sur l'inscription la plus récente de la famille, quel que soit son statut,
 * et compte donc dans `totalPaid` où un admin peut le rembourser.
 */
export async function findLatestFamilyEnrollmentId(
  schoolId: string,
  familyId: string,
  client: Prisma.TransactionClient = db
) {
  const rows = await client.enrollment.findMany({
    where: { schoolId, ...familyStudentFilter(familyId) },
    orderBy: [{ registeredAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, student: debtorFamilySelect },
  })

  return rows.find((row) => isDebtor(row, familyId))?.id ?? null
}

function familyStudentFilter(familyId: string) {
  return { student: { person: { families: { some: { familyId } } } } }
}

const debtorFamilySelect = {
  select: {
    person: {
      select: {
        families: { select: { familyId: true, relationType: true } },
      },
    },
  },
} as const

function isDebtor(row: { student: { person: { families: FamilyLink[] } } }, familyId: string) {
  return resolveDebtorFamily(row.student.person.families)?.familyId === familyId
}
