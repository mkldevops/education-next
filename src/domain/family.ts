export function validateFamilyName(name: string): 'OK' | 'validationError' {
  if (!name || name.trim().length === 0) {
    return 'validationError'
  }

  if (name.length > 50) {
    return 'validationError'
  }

  return 'OK'
}
