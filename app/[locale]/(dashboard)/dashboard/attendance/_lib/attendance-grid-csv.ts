import type { AttendanceGridColumn, AttendanceGridRow } from '@/domain/attendance-grid'
import type { AttendanceEntryStatus } from '@/generated/prisma/client'

function csvCell(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * CSV au séparateur `;` pour qu'Excel en français l'ouvre en colonnes sans import manuel. Seules les
 * séances tenues y figurent : un appel prévu non fait ou une séance annulée n'a rien à exporter.
 */
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
  const kept = columns.flatMap((column, index) =>
    column.state === 'VALIDATED' || column.state === 'DRAFT' ? [index] : []
  )
  const lines = [
    [
      headers.student,
      ...kept.map((index) => columnLabel(columns[index])),
      headers.absences,
      headers.lates,
      headers.lastPresence,
    ],
    ...rows.map((row) => [
      row.studentName,
      ...kept.map((index) => {
        const status = row.cells[index]
        return status ? codes[status] : ''
      }),
      String(row.absences),
      String(row.lates),
      row.lastPresentOn ? dayLabel(row.lastPresentOn) : headers.never,
    ]),
  ]
  return lines.map((line) => line.map(csvCell).join(';')).join('\r\n')
}
