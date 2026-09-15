import type { EventViewer } from '@/domain/event'
import { visibleEventVisibilities } from '@/domain/event'
import { eventGateway } from '@/gateways/event-gateway'

/**
 * Bandeau J-x et carte « Prochains événements » du tableau de bord. Les deux seuls
 * appelants (composants du tableau de bord) vérifient déjà `isEventsEnabled()` avant
 * d'afficher quoi que ce soit, donc cette fonction ne revérifie pas le drapeau elle-même —
 * contrairement à `listPublicEvents`, dont les appelants (page et route publiques) n'ont
 * aucune autre vérification en amont et portent donc un enjeu de confidentialité différent.
 */
export function listUpcomingEvents(
  schoolId: string,
  viewer: EventViewer,
  gw: typeof eventGateway = eventGateway,
  now: Date = new Date()
) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return gw.listUpcoming(schoolId, visibleEventVisibilities(viewer), from)
}
