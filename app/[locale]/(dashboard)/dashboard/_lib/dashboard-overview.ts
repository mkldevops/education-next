import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import type { requireSchoolScope } from '../../_lib/auth-helper'

type SchoolScope = Awaited<ReturnType<typeof requireSchoolScope>>

/**
 * Compteurs, inscriptions récentes et solde parent d'une école, tous scopés par `scope`.
 *
 * Un parent ne voit que sa propre famille : le filtre de famille est posé sur chaque
 * requête plutôt qu'appliqué après lecture.
 */
export async function getDashboardOverview(scope: SchoolScope) {
  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const periodFilter = selectedPeriod
    ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriod.id } } } }
    : {}
  const familyScope = { some: scope.isAdmin ? {} : { familyId: scope.familyId } }

  const [familyCount, studentCount, enrollmentCount, pendingPaymentCount, recentEnrollments] =
    await Promise.all([
      db.family.count({
        where: {
          schoolId: scope.schoolId,
          isActive: true,
          ...(scope.isAdmin ? {} : { id: scope.familyId }),
        },
      }),
      db.student.count({
        where: {
          schoolId: scope.schoolId,
          isActive: true,
          person: { families: familyScope },
        },
      }),
      db.enrollment.count({
        where: {
          schoolId: scope.schoolId,
          status: { in: ['PENDING', 'ACTIVE'] },
          isActive: true,
          ...periodFilter,
          student: { person: { families: familyScope } },
        },
      }),
      db.enrollment.count({
        where: {
          schoolId: scope.schoolId,
          status: 'PENDING',
          isActive: true,
          ...periodFilter,
          student: { person: { families: familyScope } },
        },
      }),
      db.enrollment.findMany({
        where: {
          schoolId: scope.schoolId,
          isActive: true,
          ...periodFilter,
          ...(scope.isAdmin ? {} : { student: { person: { families: familyScope } } }),
        },
        include: {
          student: {
            include: {
              person: true,
            },
          },
          plan: true,
          payments: true,
        },
        orderBy: { registeredAt: 'desc' },
        take: 5,
      }),
    ])

  return {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingPaymentCount,
    recentEnrollments,
    parentBalance: scope.isAdmin ? null : await getFamilyBalance(scope.schoolId, scope.familyId),
  }
}
