export type AttendancePeriodQuery = {
  range: string
  from?: string
  to?: string
  classId?: string
}

export function attendancePeriodHref({ range, from, to, classId }: AttendancePeriodQuery) {
  const params = new URLSearchParams({ view: 'period', range })
  if (range === 'custom' && from && to) {
    params.set('from', from)
    params.set('to', to)
  }
  if (classId) params.set('classId', classId)
  return `/dashboard/attendance?${params.toString()}`
}

export function attendanceDayHref(classId?: string) {
  return classId ? `/dashboard/attendance?classId=${classId}` : '/dashboard/attendance'
}

/** Lien vers l'appel d'une séance enregistrée, quelle que soit sa nature (jour, créneau, ponctuel). */
export function attendanceSessionHref({
  classPeriodId,
  day,
  occurrenceKey,
  classScheduleSlotId,
}: {
  classPeriodId: string
  day: string
  occurrenceKey: string
  classScheduleSlotId: string | null
}) {
  const params = new URLSearchParams({ date: day })
  if (occurrenceKey === 'daily' || occurrenceKey === 'adhoc')
    params.set('occurrence', occurrenceKey)
  else if (occurrenceKey === classScheduleSlotId) params.set('slotId', occurrenceKey)
  else {
    params.set('occurrence', 'historical')
    if (classScheduleSlotId) params.set('slotId', classScheduleSlotId)
  }
  return `/dashboard/my-classes/${classPeriodId}/attendance?${params.toString()}`
}
