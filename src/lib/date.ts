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

type EventDateInput = {
  allDay: boolean
  startAt: Date
  endAt?: Date | null
}

/**
 * Un événement `allDay` est stocké à minuit UTC (`normalizeEventDates`, côté domaine). Le
 * formater sans fuseau forcé lirait l'instant dans le fuseau du lecteur et afficherait la
 * veille à l'ouest de Greenwich : `timeZone: 'UTC'` fait relire le même quantième que
 * celui stocké, quel que soit le lecteur.
 *
 * Une plage dont les deux bornes tombent le même jour n'affiche la date qu'une fois.
 */
export function formatEventDate(event: EventDateInput, locale: string): string {
  const { allDay, startAt, endAt } = event

  if (allDay) {
    const options = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' } as const
    const startLabel = startAt.toLocaleDateString(locale, options)

    const sameUtcDay =
      endAt &&
      startAt.getUTCFullYear() === endAt.getUTCFullYear() &&
      startAt.getUTCMonth() === endAt.getUTCMonth() &&
      startAt.getUTCDate() === endAt.getUTCDate()
    if (!endAt || sameUtcDay) return startLabel

    return `${startLabel} – ${endAt.toLocaleDateString(locale, options)}`
  }

  const startLabel = startAt.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  if (!endAt) return startLabel

  const sameLocalDay =
    startAt.getFullYear() === endAt.getFullYear() &&
    startAt.getMonth() === endAt.getMonth() &&
    startAt.getDate() === endAt.getDate()
  if (sameLocalDay) {
    return `${startLabel} – ${endAt.toLocaleTimeString(locale, { timeStyle: 'short' })}`
  }

  return `${startLabel} – ${endAt.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}`
}
