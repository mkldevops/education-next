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
 *
 * Une date de naissance est un jour stocké à minuit UTC : les composants sont lus en UTC, sans
 * quoi un lecteur à l'ouest de Greenwich la verrait la veille. `at` est requis : rendu par un
 * composant client, l'âge doit recevoir la date du serveur, faute de quoi serveur et navigateur
 * divergent d'un jour autour d'un anniversaire et l'hydratation échoue.
 */
export function calculateAge(birthday: DateInput, at: DateInput) {
  const birth = new Date(birthday)
  const reference = new Date(at)
  let age = reference.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = reference.getUTCMonth() - birth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && reference.getUTCDate() < birth.getUTCDate())) {
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
 */
function formatEventRange(
  event: EventDateInput,
  locale: string,
  dateStyle: 'medium' | 'full'
): string {
  const { allDay, startAt, endAt } = event
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle,
    ...(allDay ? {} : { timeStyle: 'short' }),
    timeZone: 'UTC',
  })

  return endAt ? format.formatRange(startAt, endAt) : format.format(startAt)
}

/**
 * Libellé compact d'un tableau. `formatRange` applique les conventions de la locale : une plage
 * sur un seul mois ne répète ni le mois ni l'année (« 10–12 mars 2026 »), un même jour n'affiche
 * la date qu'une fois (« 10 mars 2026, 09:00 – 10:30 »).
 */
export function formatEventDate(event: EventDateInput, locale: string): string {
  return formatEventRange(event, locale, 'medium')
}

/**
 * Date « en clair » d'une affiche : jour de semaine et mois en toutes lettres, lisibles de
 * loin (« jeudi 3 décembre 2026 à 18:00 »). Même convention UTC que `formatEventDate`.
 */
export function formatEventPosterDate(event: EventDateInput, locale: string): string {
  return formatEventRange(event, locale, 'full')
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
