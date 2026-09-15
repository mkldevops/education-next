import type { EventVisibility } from '@/generated/prisma/client'

export type EventViewer = 'PUBLIC' | 'MEMBER' | 'STAFF'

const VISIBILITIES_BY_VIEWER: Record<EventViewer, EventVisibility[]> = {
  PUBLIC: ['PUBLIC'],
  MEMBER: ['PUBLIC', 'MEMBERS'],
  STAFF: ['PUBLIC', 'MEMBERS', 'STAFF'],
}

/** Échelle ORDONNÉE : un lecteur voit sa visibilité et toutes celles, plus larges, en dessous. */
export function visibleEventVisibilities(viewer: EventViewer): EventVisibility[] {
  return [...VISIBILITIES_BY_VIEWER[viewer]]
}

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g
const NON_SLUG_CHARS_PATTERN = /[^a-z0-9]+/g
const EDGE_HYPHENS_PATTERN = /^-+|-+$/g
const SLUG_MAX_LENGTH = 140

/**
 * Un suffixe automatique en cas de collision casserait silencieusement une URL déjà
 * partagée : `create-event`/`update-event` refusent plutôt un slug déjà pris
 * (`'slugTaken'`) que d'en dériver un autre ici.
 */
export function slugifyEventTitle(title: string): string {
  const withoutDiacritics = title.normalize('NFD').replace(DIACRITICS_PATTERN, '')

  return withoutDiacritics
    .toLowerCase()
    .replace(NON_SLUG_CHARS_PATTERN, '-')
    .replace(EDGE_HYPHENS_PATTERN, '')
    .slice(0, SLUG_MAX_LENGTH)
}

export function validateEventRange(input: {
  startAt: Date
  endAt?: Date | null
}): 'OK' | 'invalidDateRange' {
  if (input.endAt && input.endAt < input.startAt) return 'invalidDateRange'
  return 'OK'
}

export function normalizeEventDates<
  T extends { allDay: boolean; startAt: Date; endAt?: Date | null },
>(input: T): T {
  if (!input.allDay) return input

  // Composants de calendrier pris en UTC, jamais dans le fuseau du process : un serveur
  // qui ne tournerait pas en UTC déplacerait sinon le quantième stocké, exactement le bug
  // que la convention « allDay -> minuit UTC » doit éviter.
  return {
    ...input,
    startAt: new Date(
      Date.UTC(
        input.startAt.getUTCFullYear(),
        input.startAt.getUTCMonth(),
        input.startAt.getUTCDate()
      )
    ),
    endAt: input.endAt
      ? new Date(
          Date.UTC(
            input.endAt.getUTCFullYear(),
            input.endAt.getUTCMonth(),
            input.endAt.getUTCDate()
          )
        )
      : input.endAt,
  }
}

function addOneUtcYear(value: Date): Date {
  const year = value.getUTCFullYear() + 1
  const month = value.getUTCMonth()
  // Un 29 février n'existe pas l'année suivante : `setUTCFullYear` le reporterait au
  // 1er mars, donc dans un autre mois. Le dernier jour du même mois reste plus proche.
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const shifted = new Date(value)
  shifted.setUTCFullYear(year, month, Math.min(value.getUTCDate(), lastDayOfMonth))
  return shifted
}

/**
 * Reconduction annuelle, qui remplace délibérément une règle de récurrence : le calendrier
 * scolaire se réajuste chaque année à la main (jour de semaine, vacances), une RRULE
 * produirait des dates fausses à corriger une par une.
 *
 * Seul le début est décalé d'un an ; la fin garde son écart avec le début, pour qu'une
 * sortie de trois jours reste une sortie de trois jours.
 */
export function shiftEventToNextYear(input: { startAt: Date; endAt?: Date | null }): {
  startAt: Date
  endAt: Date | null
} {
  const startAt = addOneUtcYear(input.startAt)
  const endAt = input.endAt
    ? new Date(startAt.getTime() + (input.endAt.getTime() - input.startAt.getTime()))
    : null

  return { startAt, endAt }
}

/** Au-delà, `add-event-image` refuse avec `'tooManyImages'`. */
export const MAX_EVENT_IMAGES = 6
