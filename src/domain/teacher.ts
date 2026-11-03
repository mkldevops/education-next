export function splitTeacherName(fullName: string) {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

export function teacherName(teacher: { firstName: string; lastName: string }) {
  return `${teacher.firstName} ${teacher.lastName}`.trim()
}

/** Un membre du personnel exempté n'est jamais facturé : rien de dû, quelle que soit sa couverture. */
export function staffMealDue(
  coverage: { dueDays: number; dueAmount: number } | undefined,
  mealExempt: boolean
) {
  if (mealExempt || !coverage) return { dueDays: 0, dueAmount: 0 }
  return { dueDays: coverage.dueDays, dueAmount: coverage.dueAmount }
}
