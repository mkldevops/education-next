import type { AttendanceEntry, StudentCardLabels } from './student-attendance-card'

export type Labels = StudentCardLabels & {
  title: string
  start: string
  draft: string
  validate: string
  date: string
  schedule: string
  selectOccurrence: string
  exceptional: string
  startExceptional: string
  changeDate: string
  progress: string
  reviewAttendance: string
  partialWarning: string
  validatePartial: string
  returnToEntry: string
  correctAttendance: string
  returnClasses: string
  validatedStatus: string
  previousStudent: string
  nextStudent: string
  previous: string
  next: string
  studentPosition: string
  saveBeforeContinue: string
  summary: string
  noStudents: string
  reviewSubtitle: string
  completeStudents: string
  partialWarningSingle: string
  completeStudent: string
  all: string
  edit: string
  errors: Record<string, string>
}
export type Session = { id: string; status: string; entries: AttendanceEntry[] }
export type Slot = { id: string; startTime: string; endTime: string }
export type Payload = Pick<
  AttendanceEntry,
  'status' | 'lateMinutes' | 'message' | 'absenceReasonId'
>
export type DraftUpdate = Partial<Omit<AttendanceEntry, 'id' | 'studentName'>>
export const payload = (entry: AttendanceEntry): Payload => ({
  status: entry.status,
  lateMinutes: entry.lateMinutes,
  message: entry.message,
  absenceReasonId: entry.absenceReasonId,
})
export const same = (a: Payload, b: Payload) =>
  a.status === b.status &&
  a.lateMinutes === b.lateMinutes &&
  a.message === b.message &&
  (a.absenceReasonId ?? null) === (b.absenceReasonId ?? null)
export const errorFor = (result: unknown, labels: Labels) =>
  typeof result === 'string' ? (labels.errors[result] ?? labels.errors.unexpected) : null
