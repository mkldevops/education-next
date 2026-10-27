import type { AttendanceEntryStatus } from '@/generated/prisma/enums'

/**
 * Élèves qui n'ont pas mangé selon les appels validés d'un jour : absents à chaque appel où ils
 * figurent. Présent ou en retard à un seul appel, l'enfant compte comme servi.
 */
export function absentFromAllCalls(
  entries: ReadonlyArray<{ studentId: string; status: AttendanceEntryStatus }>
): Set<string> {
  const absent = new Set<string>()
  const present = new Set<string>()
  for (const { studentId, status } of entries) {
    if (status === 'ABSENT') absent.add(studentId)
    else if (status !== 'NOT_RECORDED') present.add(studentId)
  }
  for (const studentId of present) absent.delete(studentId)
  return absent
}
