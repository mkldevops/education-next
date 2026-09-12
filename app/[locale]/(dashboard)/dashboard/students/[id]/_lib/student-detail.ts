import { cache } from 'react'
import { db } from '@/lib/db'
import { adminOrLinkedTo, resolveDeepLink } from '../../../../_lib/deep-link'

/**
 * Résolveur unique de la page ET de `generateMetadata`.
 *
 * Le rattachement parent passe par `UserFamily` plutôt que par le `familyId` de l'école
 * active : c'est la seule forme qui reste vraie quand la ressource vit dans une autre
 * école autorisée.
 */
export const resolveStudent = cache((id: string) =>
  resolveDeepLink({
    requireAdmin: false,
    find: (access) =>
      db.student.findFirst({
        where: {
          id,
          schoolId: { in: access.schoolIds },
          ...adminOrLinkedTo(access, {
            person: {
              families: { some: { family: { users: { some: { userId: access.userId } } } } },
            },
          }),
        },
        include: {
          person: {
            include: {
              families: {
                include: {
                  family: {
                    include: {
                      persons: {
                        include: { person: { include: { phoneNumbers: true } } },
                      },
                    },
                  },
                },
              },
              phoneNumbers: true,
            },
          },
          enrollments: {
            where: { isActive: true },
            include: {
              plan: true,
              classAssignments: {
                include: {
                  classPeriod: {
                    include: {
                      period: true,
                      level: true,
                    },
                  },
                },
              },
              payments: { where: { isActive: true } },
            },
            orderBy: { registeredAt: 'desc' as const },
          },
        },
      }),
  })
)

export type StudentDetail = Extract<
  Awaited<ReturnType<typeof resolveStudent>>,
  { status: 'found' }
>['resource']

/**
 * Plans et classes proposés par le dialogue d'inscription, vides pour un parent.
 */
export async function getStudentDialogData(
  schoolId: string,
  isAdmin: boolean,
  selectedPeriodId: string | null
) {
  if (!isAdmin) return { plans: [], classes: [] }

  const [plans, classes] = await Promise.all([
    db.plan.findMany({
      where: { schoolId, isActive: true },
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

export function deriveStudentDetail(student: StudentDetail) {
  const birthday = student.birthday ? new Date(student.birthday) : null
  const totalDue = student.enrollments.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const totalPaid = student.enrollments.reduce(
    (sum, e) => sum + e.payments.reduce((acc, p) => acc + Number(p.amount), 0),
    0
  )
  const activeEnrollments = student.enrollments.filter((e) => e.status === 'ACTIVE')

  return {
    fullName: `${student.person.name} ${student.person.lastname}`,
    family: student.person.families[0]?.family ?? null,
    birthday,
    age: birthday
      ? Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null,
    totalDue,
    totalPaid,
    remaining: Math.max(0, totalDue - totalPaid),
    activeEnrollments,
    payableRemaining: student.enrollments
      .filter((e) => e.status === 'PENDING' || e.status === 'ACTIVE')
      .reduce(
        (sum, e) =>
          sum + Number(e.totalAmount) - e.payments.reduce((paid, p) => paid + Number(p.amount), 0),
        0
      ),
    languagesAtHome: Array.isArray(student.languagesAtHome)
      ? student.languagesAtHome.join(', ')
      : '',
  }
}
