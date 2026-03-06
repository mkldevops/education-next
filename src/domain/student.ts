export function validateStudentBirthday(birthday: Date): 'OK' | 'validationError' {
  const now = new Date()

  if (birthday >= now) {
    return 'validationError'
  }

  return 'OK'
}
