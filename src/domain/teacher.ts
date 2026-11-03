export function splitTeacherName(fullName: string) {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

export function teacherName(teacher: { firstName: string; lastName: string }) {
  return `${teacher.firstName} ${teacher.lastName}`.trim()
}
