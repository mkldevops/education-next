import type { EventViewer } from '@/domain/event'
import { visibleEventVisibilities } from '@/domain/event'
import { eventGateway } from '@/gateways/event-gateway'

const DEFAULT_TAKE = 10

/**
 * Carte « Prochains événements » du tableau de bord uniquement — le bandeau J-x utilise
 * `listAnnounceableEvents`, une requête distincte : les deux surfaces ne visent pas le même
 * sous-ensemble d'événements (cf. son commentaire), donc les faire partager un seul lot
 * borné a fait disparaître le bandeau, muet, dès qu'un long calendrier dépassait le plafond
 * avant d'atteindre le seul événement dont la fenêtre d'annonce était ouverte.
 *
 * L'unique appelant vérifie déjà `isEventsEnabled()` avant d'afficher quoi que ce soit,
 * donc cette fonction ne revérifie pas le drapeau elle-même — contrairement à
 * `listPublicEvents`, dont les appelants (page et route publiques) n'ont aucune autre
 * vérification en amont et portent donc un enjeu de confidentialité différent.
 */
export function listUpcomingEvents(
  schoolId: string,
  viewer: EventViewer,
  gw: typeof eventGateway = eventGateway,
  now: Date = new Date(),
  take: number = DEFAULT_TAKE
) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return gw.listUpcoming(schoolId, visibleEventVisibilities(viewer), from, take)
}
