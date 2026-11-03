import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getSchoolInsights } from './school-insights'

/**
 * Compteurs et indicateurs de l'accueil administrateur, tous bornés par
 * `schoolId`. L'accueil parent a son propre chargeur, borné par la famille liée.
 */
export async function getDashboardOverview(schoolId: string, paymentsEnabled: boolean) {
  const selectedPeriod = await getSelectedPeriod(schoolId)
  const periodFilter = selectedPeriod
    ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriod.id } } } }
    : {}

  const [familyCount, studentCount, enrollmentCount, pendingEnrollmentCount, insights] =
    await Promise.all([
      db.family.count({ where: { schoolId, isActive: true } }),
      db.student.count({ where: { schoolId, isActive: true } }),
      db.enrollment.count({
        where: { schoolId, status: { in: ['PENDING', 'ACTIVE'] }, isActive: true, ...periodFilter },
      }),
      db.enrollment.count({
        where: { schoolId, status: 'PENDING', isActive: true, ...periodFilter },
      }),
      getSchoolInsights(schoolId, selectedPeriod?.id ?? null, paymentsEnabled),
    ])

  return {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingEnrollmentCount,
    insights,
  }
}
