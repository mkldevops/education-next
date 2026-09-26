const DATE_ONLY_LENGTH = 10

export function isDateOnly(value: string): boolean {
  return value.length === DATE_ONLY_LENGTH
}

/** Heure murale sans fuseau lue en UTC, exactement comme `parseEventInputValue`. */
export function toWallClock(value: string): Date {
  if (isDateOnly(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value.endsWith('Z') ? value : `${value}Z`)
}

type EventRow = {
  id: string
  slug: string
  title: string
  category: string
  visibility: string
  status: string
  allDay: boolean
  startAt: Date
  endAt: Date | null
  location: string | null
}

/**
 * Réponse des écritures d'événement : la ligne rendue par le use case est entière, elle
 * porte `schoolId` et les horodatages techniques, qui n'ont rien à faire dans le contexte
 * du fournisseur de modèle. Mêmes colonnes que `list_events`.
 */
export function publishEvent(event: EventRow) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    category: event.category,
    visibility: event.visibility,
    status: event.status,
    allDay: event.allDay,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
  }
}
