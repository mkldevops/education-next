type DateInput = Date | string | number

export function formatDate(value: DateInput, locale: string) {
  return new Date(value).toLocaleDateString(locale)
}

export function formatDateLong(value: DateInput, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value: DateInput, locale: string) {
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Âge révolu en années, à la date `at`.
 *
 * L'anniversaire n'est compté que s'il est passé : un élève né le 31/12 a encore l'âge de
 * l'année précédente le 30/12, ce que la simple différence de millésimes fait faux.
 */
export function calculateAge(birthday: DateInput, at: DateInput = new Date()) {
  const birth = new Date(birthday)
  const reference = new Date(at)
  let age = reference.getFullYear() - birth.getFullYear()
  const monthDelta = reference.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && reference.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}
