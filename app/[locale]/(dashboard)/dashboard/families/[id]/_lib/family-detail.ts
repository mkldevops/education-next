import { cache } from 'react'
import { db } from '@/lib/db'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import type { FamilyBalance } from '@/use-cases/payments/family-balance'
import { adminOrLinkedTo, resolveDeepLink } from '../../../../_lib/deep-link'

/**
 * Résolveur unique de la page ET de `generateMetadata`.
 *
 * Un parent n'est pas contraint par la famille de son école active mais par son propre
 * rattachement (`users`) : sinon un lien profond vers son dossier d'une autre école
 * renverrait `notFound()` au lieu de proposer la bascule.
 */
export const resolveFamily = cache((id: string) =>
  resolveDeepLink({
    requireAdmin: false,
    find: (access) =>
      db.family.findFirst({
        where: {
          id,
          schoolId: { in: access.schoolIds },
          ...adminOrLinkedTo(access, { users: { some: { userId: access.userId } } }),
        },
        include: {
          persons: {
            where: { person: { isActive: true } },
            include: {
              person: {
                include: {
                  student: {
                    where: { isActive: true },
                    include: {
                      enrollments: {
                        where: { isActive: true },
                        // La carte enfant nomme « l'inscription courante » la plus récente :
                        // sans ordre explicite, Postgres rendait un premier élément arbitraire.
                        orderBy: { registeredAt: 'desc' },
                        include: {
                          plan: true,
                          classAssignments: {
                            where: { endAt: null },
                            include: {
                              classPeriod: {
                                include: {
                                  period: true,
                                  level: true,
                                },
                              },
                            },
                          },
                          payments: {
                            where: { isActive: true },
                          },
                        },
                      },
                    },
                  },
                  phoneNumbers: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          },
          users: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
          payments: {
            where: { isActive: true },
            include: {
              enrollment: {
                include: {
                  student: {
                    include: { person: true },
                  },
                  plan: true,
                },
              },
            },
            orderBy: { paidAt: 'desc' as const },
          },
        },
      }),
  })
)

export type FamilyDetail = Extract<
  Awaited<ReturnType<typeof resolveFamily>>,
  { status: 'found' }
>['resource']

export function serializeFamilyPayments(payments: FamilyDetail['payments']) {
  return payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
    enrollment: {
      ...payment.enrollment,
      totalAmount: Number(payment.enrollment.totalAmount),
      discount: Number(payment.enrollment.discount),
      plan: {
        ...payment.enrollment.plan,
        amount: Number(payment.enrollment.plan.amount),
      },
    },
  }))
}

export type FamilyDetailPayment = ReturnType<typeof serializeFamilyPayments>[number]

/**
 * Plans et classes proposés par les dialogues d'administration, vides pour un parent.
 */
export async function getFamilyDialogData(
  schoolId: string,
  isAdmin: boolean,
  selectedPeriodId: string | null
) {
  if (!isAdmin) return { plans: [], classes: [] }

  const [plans, classes] = await Promise.all([
    db.plan.findMany({
      where: { schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
      orderBy: { name: 'asc' },
    }),
    db.classPeriod.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
      },
      include: { level: true, period: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return { plans, classes }
}

export function deriveFamilyDetail(
  family: FamilyDetail,
  balance: FamilyBalance,
  studentId: string | undefined
) {
  const students = family.persons
    .filter(
      (
        fp
      ): fp is typeof fp & {
        person: typeof fp.person & { student: NonNullable<typeof fp.person.student> }
      } => fp.person.student !== null
    )
    .map((familyPerson) => ({
      ...familyPerson,
      person: {
        ...familyPerson.person,
        student: {
          ...familyPerson.person.student,
          enrollments: familyPerson.person.student.enrollments.map((enrollment) => ({
            ...enrollment,
            totalAmount: Number(enrollment.totalAmount),
            discount: Number(enrollment.discount),
            plan: {
              ...enrollment.plan,
              amount: Number(enrollment.plan.amount),
            },
            payments: enrollment.payments.map((payment) => ({
              ...payment,
              amount: Number(payment.amount),
            })),
          })),
        },
      },
    }))

  const allEnrollments = students.flatMap((s) =>
    s.person.student.enrollments.map((e) => ({
      ...e,
      studentName: `${s.person.name} ${s.person.lastname}`,
    }))
  )

  return {
    students,
    allEnrollments,
    enrolledChildren: students.filter((s) => s.person.student.enrollments.length > 0).length,
    activeEnrollments: allEnrollments.filter((e) => e.status === 'ACTIVE').length,
    pendingCount: allEnrollments.filter((e) => e.status === 'PENDING').length,
    scopedStudentId: students.some((s) => s.person.student.id === studentId)
      ? studentId
      : undefined,
    totalAmount: balance.totalAmount,
    totalDiscount: balance.totalDiscount,
    totalPaid: balance.totalPaid,
    remainingBalance: balance.remainingBalance,
  }
}

export type FamilyDetailStudent = ReturnType<typeof deriveFamilyDetail>['students'][number]
export type FamilyDetailEnrollment = ReturnType<typeof deriveFamilyDetail>['allEnrollments'][number]
