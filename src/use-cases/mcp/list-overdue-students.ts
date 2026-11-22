import { roundHalfUp } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { getOverdueStudents } from '@/use-cases/payments/overdue-students'
import type { DraftScope } from './draft-scope'

/**
 * Élèves en retard de paiement, sans avoir à parcourir tout l'annuaire : le retard est
 * celui de leur famille redevable, et `families` dit combien de familles sont concernées.
 */
export async function listOverdueStudentsFromMcp(
  scope: DraftScope,
  overdueStudents = getOverdueStudents,
  regionalSettings = getSchoolRegionalSettings
) {
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const [students, { currency }] = await Promise.all([
    overdueStudents(scope.schoolId),
    regionalSettings(scope.schoolId),
  ])
  const families = new Map(students.map((student) => [student.family.id, student.family]))
  return {
    currency,
    total: students.length,
    families: families.size,
    totalOverdueAmount: roundHalfUp(
      [...families.values()].reduce((sum, family) => sum + family.overdueAmount, 0)
    ),
    students,
  }
}
