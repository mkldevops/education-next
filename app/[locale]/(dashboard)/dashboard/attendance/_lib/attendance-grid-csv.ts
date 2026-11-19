import type { AttendanceGridColumn, AttendanceGridRow } from '@/domain/attendance-grid'
import type { AttendanceEntryStatus } from '@/generated/prisma/client'

function csvCell(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** CSV au séparateur `;` pour qu'Excel en français l'ouvre en colonnes sans import manuel. */
export function attendanceGridCsv({
  columns,
  rows,
  columnLabel,
  dayLabel,
  codes,
  headers,
}: {
  columns: AttendanceGridColumn[]
  rows: AttendanceGridRow[]
  columnLabel: (column: AttendanceGridColumn) => string
  dayLabel: (date: Date) => string
  codes: Record<AttendanceEntryStatus, string>
  headers: { student: string; absences: string; lates: string; lastPresence: string; never: string }
}) {
  const lines = [
    [
      headers.student,
      ...columns.map(columnLabel),
      headers.absences,
      headers.lates,
      headers.lastPresence,
    ],
    ...rows.map((row) => [
      row.studentName,
      ...row.cells.map((status) => (status ? codes[status] : '')),
      String(row.absences),
      String(row.lates),
      row.lastPresentOn ? dayLabel(row.lastPresentOn) : headers.never,
    ]),
  ]
  return lines.map((line) => line.map(csvCell).join(';')).join('\r\n')
}
