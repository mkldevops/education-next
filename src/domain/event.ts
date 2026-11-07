import type { EventStatus, EventVisibility } from '@/generated/prisma/client'
import { DAY_MS, utcStartOfDay } from './day'

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
    startAt: utcStartOfDay(input.startAt),
    endAt: input.endAt ? utcStartOfDay(input.endAt) : input.endAt,
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

/**
 * Filtre défensif, appliqué EN PLUS de la requête Prisma qui pose déjà les mêmes bornes.
 *
 * Le commentaire du modèle `Event` rappelle que la route média (`/api/media/events/…`) ne
 * vérifie ni la visibilité ni le statut d'un événement — sa seule protection est la clé
 * d'objet non énumérable. Toute lecture qui alimente une surface publique (page publique,
 * flux ICS) doit donc garantir elle-même qu'aucun événement MEMBERS/STAFF/DRAFT ne peut s'y
 * glisser, même si la requête SQL en amont change un jour sans que ce filtre suive.
 *
 * `DRAFT` est le seul statut exclu : `CANCELLED` reste diffusé, barré, comme partout
 * ailleurs dans l'application (cf. doctrine du modèle `Event`).
 */
export function filterVisibleEvents<T extends { visibility: EventVisibility; status: EventStatus }>(
  events: T[],
  visibilities: EventVisibility[]
): T[] {
  return events.filter(
    (event) => visibilities.includes(event.visibility) && event.status !== 'DRAFT'
  )
}

/**
 * Bandeau J-x : l'événement PUBLISHED le plus proche dont la fenêtre d'annonce est
 * ouverte. `announceDaysBefore` porte cette fenêtre par événement — `null` signifie
 * « aucune annonce » (cf. commentaire du modèle `Event`) : un événement qui ne porte pas
 * ce champ n'est jamais choisi, quelle que soit sa proximité dans le temps. `CANCELLED`
 * est exclu : le bandeau annonce un événement à venir, il n'a pas vocation à publier une
 * annulation.
 *
 * Un événement `allDay` est stocké à minuit UTC (`normalizeEventDates`) : le comparer
 * strictement à `now` ferait disparaître le bandeau à 00:00 UTC le jour même de
 * l'événement, exactement quand il compte le plus — et désynchroniserait ce choix de
 * `listAnnounceableEvents`, qui plafonne sa propre borne au début du jour UTC pour que
 * « today » y reste inclus. Un `allDay` reste donc annoncé tant que le jour UTC courant n'a
 * pas dépassé son `startAt` ; un événement horodaté garde la comparaison stricte à l'instant.
 */
export function selectAnnouncedEvent<
  T extends {
    status: EventStatus
    startAt: Date
    announceDaysBefore: number | null
    allDay: boolean
  },
>(events: T[], now: Date): T | null {
  const todayStart = utcStartOfDay(now)

  const eligible = events.filter((event) => {
    if (event.status !== 'PUBLISHED' || event.announceDaysBefore === null) return false
    const opensAt = event.startAt.getTime() - event.announceDaysBefore * DAY_MS
    const hasNotPassed = event.allDay
      ? event.startAt.getTime() >= todayStart.getTime()
      : event.startAt.getTime() > now.getTime()
    return hasNotPassed && opensAt <= now.getTime()
  })

  if (eligible.length === 0) return null

  return eligible.reduce((nearest, event) => (event.startAt < nearest.startAt ? event : nearest))
}

/**
 * Taille du fichier reçu, avant sa conversion en WebP. Partagée avec le dialogue : au-delà
 * de la limite de corps des Server Actions, Next.js coupe la requête avant que l'action ne
 * puisse répondre `fileTooLarge`, le contrôle doit donc précéder l'envoi.
 */
export const MAX_EVENT_IMAGE_BYTES = 10 * 1024 * 1024

export type EventPageAccess = 'public' | 'preview' | 'hidden'

/**
 * Accès à la page publique d'un événement.
 *
 * Seul un événement `PUBLIC` et sorti du brouillon s'affiche hors session. Un événement
 * annulé reste lisible, comme dans les listes : un lien déjà partagé doit annoncer
 * l'annulation plutôt que tomber sur une 404. Tout le reste n'est ouvert qu'à un
 * administrateur de l'école, en aperçu.
 */
export function resolveEventPageAccess(
  event: { visibility: EventVisibility; status: EventStatus },
  viewerIsSchoolAdmin: boolean
): EventPageAccess {
  if (event.visibility === 'PUBLIC' && event.status !== 'DRAFT') return 'public'
  return viewerIsSchoolAdmin ? 'preview' : 'hidden'
}

/**
 * Nouvel ordre des images quand `imageId` devient la couverture : elle passe en tête, les
 * autres gardent leur ordre relatif. `null` si l'image n'appartient pas à la liste.
 */
export function reorderImagesForCover<T extends { id: string }>(
  images: T[],
  imageId: string
): T[] | null {
  const cover = images.find((image) => image.id === imageId)
  if (!cover) return null
  return [cover, ...images.filter((image) => image.id !== imageId)]
}

/** Chemin, sans préfixe de langue, du calendrier public d'une école. */
export function schoolEventsPublicPath(schoolSlug: string): string {
  return `/ecole/${schoolSlug}/evenements`
}

/** Chemin, sans préfixe de langue, de la page publique d'un événement. */
export function eventPublicPath(schoolSlug: string, eventSlug: string): string {
  return `${schoolEventsPublicPath(schoolSlug)}/${eventSlug}`
}

export type EventPeriodBounds = { from: Date; until: Date }

/**
 * Bornes d'une période scolaire pour filtrer ses événements. `Period.endAt` est un jour
 * inclus : la borne haute exclusive est le minuit UTC du lendemain, sinon une réunion le
 * soir du dernier jour sortirait de la liste. Un événement y figure dès qu'il chevauche la
 * période — des vacances commencées fin août restent visibles en septembre.
 */
export function eventPeriodBounds(period: { startAt: Date; endAt: Date }): EventPeriodBounds {
  const { endAt } = period
  return {
    from: period.startAt,
    until: new Date(Date.UTC(endAt.getUTCFullYear(), endAt.getUTCMonth(), endAt.getUTCDate() + 1)),
  }
}
