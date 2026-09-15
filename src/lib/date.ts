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
 * Un événement est stocké en heure murale de l'école, exprimée en UTC : `allDay` fige minuit
 * UTC (`normalizeEventDates`, côté domaine), et un événement horaire garde l'heure saisie
 * telle quelle. Lecture et écriture DOIVENT donc forcer UTC des deux côtés.
 *
 * Sans fuseau forcé, le rendu — un composant serveur — prendrait celui du process (UTC en
 * conteneur) tandis que la saisie prendrait celui du navigateur : un administrateur à Paris
 * verrait 18:00 pour une réunion enregistrée à 20:00, et chaque enregistrement sans
 * modification décalerait l'instant de son décalage horaire.
 *
 * Une plage dont les deux bornes tombent le même jour n'affiche la date qu'une fois.
 */
export function formatEventDate(event: EventDateInput, locale: string): string {
  const { allDay, startAt, endAt } = event

  const sameUtcDay =
    endAt &&
    startAt.getUTCFullYear() === endAt.getUTCFullYear() &&
    startAt.getUTCMonth() === endAt.getUTCMonth() &&
    startAt.getUTCDate() === endAt.getUTCDate()

  if (allDay) {
    const options = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' } as const
    const startLabel = startAt.toLocaleDateString(locale, options)

    if (!endAt || sameUtcDay) return startLabel

    return `${startLabel} – ${endAt.toLocaleDateString(locale, options)}`
  }

  const full = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } as const
  const startLabel = startAt.toLocaleString(locale, full)
  if (!endAt) return startLabel

  if (sameUtcDay) {
    const time = { timeStyle: 'short', timeZone: 'UTC' } as const
    return `${startLabel} – ${endAt.toLocaleString(locale, time)}`
  }

  return `${startLabel} – ${endAt.toLocaleString(locale, full)}`
}

const INPUT_DATE_LENGTH = 10

/**
 * Valeur d'un champ `date` (AAAA-MM-JJ) ou `datetime-local` (AAAA-MM-JJTHH:MM) pour un
 * instant stocké. Les composants sont pris en UTC : le champ affiche l'heure murale de
 * l'école, et basculer « journée entière » ne change plus le quantième affiché.
 */
export function toEventInputValue(value: Date, allDay: boolean): string {
  const iso = value.toISOString()

  return allDay ? iso.slice(0, INPUT_DATE_LENGTH) : iso.slice(0, 16)
}

/**
 * Inverse de `toEventInputValue`. `new Date(value)` lirait un `datetime-local` dans le fuseau
 * du navigateur ; le suffixe explicite conserve l'heure saisie.
 */
export function parseEventInputValue(value: string): Date {
  return new Date(
    value.length === INPUT_DATE_LENGTH ? `${value}T00:00:00.000Z` : `${value}:00.000Z`
  )
}
