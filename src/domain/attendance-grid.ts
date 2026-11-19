import type { AttendanceEntryStatus } from '@/generated/prisma/client'

export type AttendanceGridSession = {
  id: string
  occurredOn: Date
  occurrenceKey: string
  classScheduleSlotId: string | null
  startTime: string | null
  entries: { studentId: string; studentName: string; status: AttendanceEntryStatus }[]
}

export type AttendanceGridColumn = {
  sessionId: string
  occurredOn: Date
  occurrenceKey: string
  classScheduleSlotId: string | null
  startTime: string | null
}

export type AttendanceGridRow = {
  studentId: string
  studentName: string
  cells: (AttendanceEntryStatus | null)[]
  absences: number
  lates: number
  lastPresentOn: Date | null
}

/**
 * Fiche d'appel sur plusieurs jours : une colonne par séance, une ligne par élève inscrit à au
 * moins une séance. Les élèves sans présence récente remontent en tête pour être relancés.
 * `lastPresentOn` vient de tout l'historique de la classe, pas seulement de la plage affichée.
 */
export function buildAttendanceGrid(
  sessions: AttendanceGridSession[],
  lastPresentOn: ReadonlyMap<string, Date>
): { columns: AttendanceGridColumn[]; rows: AttendanceGridRow[] } {
  const ordered = [...sessions].sort(
    (a, b) =>
      a.occurredOn.getTime() - b.occurredOn.getTime() ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.occurrenceKey.localeCompare(b.occurrenceKey)
  )
  const columns = ordered.map((session) => ({
    sessionId: session.id,
    occurredOn: session.occurredOn,
    occurrenceKey: session.occurrenceKey,
    classScheduleSlotId: session.classScheduleSlotId,
    startTime: session.startTime,
  }))

  const names = new Map<string, string>()
  for (const session of ordered) {
    for (const entry of session.entries) names.set(entry.studentId, entry.studentName)
  }

  const rows = [...names].map(([studentId, studentName]) => {
    const cells = ordered.map(
      (session) => session.entries.find((entry) => entry.studentId === studentId)?.status ?? null
    )
    return {
      studentId,
      studentName,
      cells,
      absences: cells.filter((status) => status === 'ABSENT').length,
      lates: cells.filter((status) => status === 'LATE').length,
      lastPresentOn: lastPresentOn.get(studentId) ?? null,
    }
  })

  rows.sort(
    (a, b) =>
      (a.lastPresentOn?.getTime() ?? Number.NEGATIVE_INFINITY) -
        (b.lastPresentOn?.getTime() ?? Number.NEGATIVE_INFINITY) ||
      b.absences - a.absences ||
      a.studentName.localeCompare(b.studentName, 'fr')
  )

  return { columns, rows }
}
