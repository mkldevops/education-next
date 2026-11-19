export type AttendancePeriodQuery = {
  range: string
  from?: string
  to?: string
  classId?: string
  all?: boolean
}

export function attendancePeriodHref({ range, from, to, classId, all }: AttendancePeriodQuery) {
  const params = new URLSearchParams({ range })
  if (range === 'custom' && from && to) {
    params.set('from', from)
    params.set('to', to)
  }
  if (classId) params.set('classId', classId)
  if (all) params.set('all', '1')
  return `/dashboard/attendance?${params.toString()}`
}

/**
 * Lien vers l'appel d'une séance, enregistrée ou seulement prévue, quelle que soit sa nature
 * (jour, créneau, ponctuel).
 */
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

/** Écran d'appel d'une date sans séance choisie : il propose les créneaux du jour ou un appel ponctuel. */
export function attendanceNewCallHref(classPeriodId: string, day: string) {
  return `/dashboard/my-classes/${classPeriodId}/attendance?date=${day}`
}
