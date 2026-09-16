export function attendanceClassPeriodScope({
  periodId,
  classId,
  teacherId,
}: {
  periodId?: string
  classId?: string
  teacherId?: string
}) {
  if (!periodId) return null
  return {
    isActive: true,
    periodId,
    ...(classId ? { id: classId } : {}),
    ...(teacherId ? { teachers: { some: { teacherId } } } : {}),
  }
}
