import { absentFromAllCalls } from '@/domain/meal-absence-from-attendance'
import { servedDays } from '@/domain/meal-ledger'
import { isSchoolClosed } from '@/domain/school-closure'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'

type Input = { schoolId: string; sessionId: string; recordedById: string }

/**
 * Recale les repas d'un jour sur ses appels validés (R7) : un enfant absent à chaque appel n'a pas
 * mangé, son jour servi est recrédité ; présent à un appel, l'absence posée par les appels tombe.
 * Une absence saisie à la main n'est jamais touchée.
 */
export async function syncMealAbsencesFromAttendance(
  { schoolId, sessionId, recordedById }: Input,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const session = await accountGw.findSessionDay(schoolId, sessionId)
  if (!session || session.studentIds.length === 0) return 'OK' as const
  const { day, studentIds } = session
  const closures = await accountGw.findClosures(schoolId, day, day)
  const isClosed = (d: string) => isSchoolClosed(closures, new Date(`${d}T00:00:00.000Z`))

  return accountGw.transaction(async (tx) => {
    const accounts = await accountGw.lockAccounts(
      tx,
      schoolId,
      studentIds.flatMap((studentId) => [
        { studentId, service: 'CANTEEN' as const },
        { studentId, service: 'SNACK' as const },
      ])
    )
    if (accounts.length === 0) return 'OK' as const
    const absent = absentFromAllCalls(
      await accountGw.listValidatedEntries(tx, schoolId, day, studentIds)
    )
    const segments = await accountGw.listSegments(
      tx,
      schoolId,
      accounts.map((account) => account.id)
    )
    for (const account of accounts) {
      if (!absent.has(account.studentId)) {
        await accountGw.removeAttendanceAbsence(tx, schoolId, account.id, day)
        continue
      }
      const served = servedDays({
        segments: segments
          .filter((segment) => segment.accountId === account.id)
          .map((segment) => ({ ...segment, endOn: segment.endOn ?? segment.periodEnd })),
        periodEnd: day,
        isClosed,
      })
      if (served.includes(day)) {
        await accountGw.addAttendanceAbsence(tx, schoolId, {
          accountId: account.id,
          day,
          recordedById,
        })
      }
    }
    return 'OK' as const
  })
}
