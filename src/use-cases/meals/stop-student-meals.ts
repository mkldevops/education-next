import { planStop } from '@/domain/meal-schedule'
import { schoolToday } from '@/domain/school-date'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

/**
 * Arrêt automatique à l'archivage d'un élève ou à l'annulation d'une inscription : plus
 * aucun jour servi dès aujourd'hui. `enrollmentId` limite l'arrêt aux périodes de ses
 * classes. Sans drapeau : un compte ouvert doit s'arrêter même si l'école s'est retirée.
 */
export async function stopStudentMeals(
  input: { schoolId: string; studentId: string; enrollmentId?: string },
  accountGw = mealAccountGateway,
  now = new Date()
) {
  const { schoolId, studentId, enrollmentId } = input
  const periodIds = enrollmentId
    ? await accountGw.findEnrollmentPeriodIds(schoolId, enrollmentId)
    : undefined
  if (periodIds?.length === 0) return

  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone, now)

  await accountGw.transaction(async (tx) => {
    const accountIds = await accountGw.lockStudentAccounts(tx, schoolId, studentId)
    if (accountIds.length === 0) return

    const segments = await accountGw.listSegments(tx, schoolId, accountIds, periodIds)
    await accountGw.applyStop(tx, schoolId, planStop(segments, today))
  })
}
