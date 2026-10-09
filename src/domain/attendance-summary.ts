type EntryStatus = 'NOT_RECORDED' | 'PRESENT' | 'LATE' | 'ABSENT'

export type AttendanceSummary = {
  present: number
  late: number
  absent: number
  notRecorded: number
  /** Part des élèves venus (présents ou en retard) parmi les statuts saisis ; nul sans saisie. */
  rate: number | null
}

export function summarizeAttendance(statuses: readonly EntryStatus[]): AttendanceSummary {
  const summary = { present: 0, late: 0, absent: 0, notRecorded: 0 }
  for (const status of statuses) {
    if (status === 'PRESENT') summary.present++
    else if (status === 'LATE') summary.late++
    else if (status === 'ABSENT') summary.absent++
    else summary.notRecorded++
  }
  const recorded = summary.present + summary.late + summary.absent
  return {
    ...summary,
    rate: recorded === 0 ? null : Math.round(((summary.present + summary.late) / recorded) * 100),
  }
}
