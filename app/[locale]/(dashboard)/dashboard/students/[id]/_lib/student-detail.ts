import { cache } from 'react'
import { languagesOf } from '@/domain/family'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { enrollmentBalances } from '@/domain/payment'
import { calculateAge } from '@/lib/date'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { classOptionSelect, toClassOption } from '../../../../_lib/class-options-loader'
import { adminOrLinkedTo, familyLinksVisibleTo, resolveDeepLink } from '../../../../_lib/deep-link'

/**
 * Résolveur unique de la page ET de `generateMetadata`.
 *
 * Le rattachement parent passe par `UserFamily` plutôt que par le `familyId` de l'école
 * active : c'est la seule forme qui reste vraie quand la ressource vit dans une autre
 * école autorisée.
 *
 * Les familles incluses sont filtrées par le même critère : le garde de racine ouvre
 * la fiche, il ne borne pas ce qu'elle embarque.
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
                where: familyLinksVisibleTo(access),
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
      where: { schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
      orderBy: { name: 'asc' },
    }),
    db.classPeriod.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
      },
      select: {
        ...classOptionSelect,
        level: { select: { name: true } },
        period: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    plans,
    classes: classes.map((c) => toClassOption(c, `${c.name} (${c.level.name} — ${c.period.name})`)),
  }
}

export function deriveStudentDetail(student: StudentDetail) {
  const birthday = student.birthday ? new Date(student.birthday) : null
  const totalDue = student.enrollments.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const totalPaid = student.enrollments.reduce(
    (sum, e) => sum + e.payments.reduce((acc, p) => acc + Number(p.amount), 0),
    0
  )
  const activeEnrollments = student.enrollments.filter((e) => e.status === 'ACTIVE')
  // Un parent ne reçoit que ses propres rattachements ; un administrateur les reçoit
  // tous, sans ordre garanti par Postgres. La famille affichée est la redevable.
  const family = resolveDebtorFamily(student.person.families)?.family ?? null

  return {
    fullName: `${student.person.name} ${student.person.lastname}`,
    family,
    birthday,
    age: birthday ? calculateAge(birthday, new Date()) : null,
    totalDue,
    totalPaid,
    remaining: Math.max(0, totalDue - totalPaid),
    activeEnrollments,
    payableRemaining: roundHalfUp(
      enrollmentBalances(
        student.enrollments.filter((e) => e.status === 'PENDING' || e.status === 'ACTIVE')
      ).reduce((sum, balance) => sum + balance.remainingBalance, 0)
    ),
    languagesAtHome: languagesOf(family?.languagesAtHome).join(', '),
  }
}
