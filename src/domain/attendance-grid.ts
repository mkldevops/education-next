import type { AttendanceEntryStatus, AttendanceSessionStatus } from '@/generated/prisma/client'

export type AttendanceGridSession = {
  id: string
  occurredOn: Date
  occurrenceKey: string
  classScheduleSlotId: string | null
  startTime: string | null
  status: AttendanceSessionStatus
  entries: { studentId: string; studentName: string; status: AttendanceEntryStatus }[]
}

export type AttendanceGridPlanned = {
  occurredOn: Date
  occurrenceKey: string
  classScheduleSlotId: string
  startTime: string
  state: 'missed' | 'todo'
}

/** `missed` et `todo` sont des appels prévus sans séance ; les autres états sont ceux de la séance. */
export type AttendanceGridColumnState = AttendanceSessionStatus | AttendanceGridPlanned['state']

export type AttendanceGridColumn = {
  key: string
  sessionId: string | null
  occurredOn: Date
  occurrenceKey: string
  classScheduleSlotId: string | null
  startTime: string | null
  state: AttendanceGridColumnState
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
 * Fiche d'appel sur plusieurs jours : une colonne par séance ou par appel prévu non commencé, une
 * ligne par élève inscrit à au moins une séance tenue. Une séance annulée garde sa colonne sans
 * compter dans les absences. Les élèves sans présence récente remontent en tête pour être relancés.
 * `lastPresentOn` vient de tout l'historique de la classe, pas seulement de la plage affichée.
 */
export function buildAttendanceGrid(
  sessions: AttendanceGridSession[],
  lastPresentOn: ReadonlyMap<string, Date>,
  planned: AttendanceGridPlanned[] = []
): { columns: AttendanceGridColumn[]; rows: AttendanceGridRow[] } {
  const items = [
    ...sessions.map((session) => ({
      column: {
        key: session.id,
        sessionId: session.id,
        occurredOn: session.occurredOn,
        occurrenceKey: session.occurrenceKey,
        classScheduleSlotId: session.classScheduleSlotId,
        startTime: session.startTime,
        state: session.status,
      } satisfies AttendanceGridColumn,
      entries: session.status === 'CANCELLED' ? [] : session.entries,
    })),
    ...planned.map((call) => ({
      column: {
        key: `${call.occurredOn.toISOString().slice(0, 10)}:${call.occurrenceKey}`,
        sessionId: null,
        occurredOn: call.occurredOn,
        occurrenceKey: call.occurrenceKey,
        classScheduleSlotId: call.classScheduleSlotId,
        startTime: call.startTime,
        state: call.state,
      } satisfies AttendanceGridColumn,
      entries: [],
    })),
  ]
  const ordered = items.sort(
    (a, b) =>
      a.column.occurredOn.getTime() - b.column.occurredOn.getTime() ||
      (a.column.startTime ?? '').localeCompare(b.column.startTime ?? '') ||
      a.column.occurrenceKey.localeCompare(b.column.occurrenceKey)
  )
  const columns = ordered.map((item) => item.column)

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
