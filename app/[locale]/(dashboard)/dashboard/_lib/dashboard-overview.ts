import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import type { SchoolScope } from '../../_lib/auth-helper'
import { getSchoolInsights, type SchoolInsights } from './school-insights'

/**
 * Compteurs, inscriptions récentes et solde parent d'une école, tous scopés par `scope`.
 *
 * Un parent ne voit que sa propre famille : le filtre de famille est posé sur chaque
 * requête plutôt qu'appliqué après lecture.
 */
export async function getDashboardOverview(scope: SchoolScope, paymentsEnabled: boolean) {
  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const periodFilter = selectedPeriod
    ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriod.id } } } }
    : {}
  const familyScope = { some: scope.isAdmin ? {} : { familyId: scope.familyId } }

  const [
    familyCount,
    studentCount,
    enrollmentCount,
    pendingPaymentCount,
    recentEnrollments,
    insights,
  ] = await Promise.all([
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
        // Alimente uniquement la colonne de progression de règlement : ne pas la tirer
        // quand elle ne sera pas affichée.
        ...(paymentsEnabled ? { payments: true } : {}),
        classAssignments: {
          include: { classPeriod: { include: { level: true } } },
          orderBy: { startAt: 'desc' },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 5,
    }),
    scope.isAdmin
      ? getSchoolInsights(scope.schoolId, selectedPeriod?.id ?? null, paymentsEnabled)
      : Promise.resolve<SchoolInsights | null>(null),
  ])

  return {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingPaymentCount,
    recentEnrollments,
    // Ni la carte admin ni le solde parent ne s'affichent drapeau coupé : la lecture ne
    // sert à rien.
    parentBalance:
      scope.isAdmin || !paymentsEnabled
        ? null
        : await getFamilyBalance(scope.schoolId, scope.familyId),
    insights,
  }
}
