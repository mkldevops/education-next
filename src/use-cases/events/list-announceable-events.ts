import type { EventViewer } from '@/domain/event'
import { visibleEventVisibilities } from '@/domain/event'
import { eventGateway } from '@/gateways/event-gateway'

const DEFAULT_TAKE = 10

/**
 * Bandeau J-x uniquement. Distinct de `listUpcomingEvents` (carte « Prochains
 * événements ») : `eventGateway.listAnnounceable` filtre déjà `status: 'PUBLISHED'` et
 * `announceDaysBefore: { not: null }` au niveau de la requête, avant `take` — les deux
 * seules conditions que `selectAnnouncedEvent` exige jamais pour choisir un événement.
 * Repousser ce filtre côté domaine seul aurait laissé le plafond porter sur des lignes qui
 * ne pouvaient de toute façon jamais être choisies.
 */
export function listAnnounceableEvents(
  schoolId: string,
  viewer: EventViewer,
  gw: typeof eventGateway = eventGateway,
  now: Date = new Date(),
  take: number = DEFAULT_TAKE
) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return gw.listAnnounceable(schoolId, visibleEventVisibilities(viewer), from, take)
}
