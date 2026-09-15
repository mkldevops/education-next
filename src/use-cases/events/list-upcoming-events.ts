import { cache } from 'react'
import type { EventViewer } from '@/domain/event'
import { visibleEventVisibilities } from '@/domain/event'
import { eventGateway } from '@/gateways/event-gateway'

const DEFAULT_TAKE = 10

/**
 * Mémoïsé pour la durée d'un rendu : le bandeau (layout) et la carte (page) appellent
 * cette fonction avec les mêmes `schoolId`/`viewer`/`take` par défaut dans le même rendu du
 * tableau de bord, donc `React.cache()` réduit ça à une seule requête.
 *
 * Seuls des arguments PRIMITIFS (`schoolId`, `viewer`, `fromMs`, `take`) entrent dans la
 * clé de mémoïsation, `gw` mis à part (référence stable du singleton par défaut) : un objet
 * `Date` ou un tableau y romprait le partage, puisque deux appels en produiraient deux
 * instances différentes — donc deux clés différentes — même avec un contenu identique.
 * `fromMs` vient du début du jour UTC courant, donc deux appels à quelques millisecondes
 * d'écart (bandeau puis carte) tombent sur la même clé tant qu'ils restent le même jour.
 *
 * Les deux seuls appelants (composants du tableau de bord) vérifient déjà
 * `isEventsEnabled()` avant d'afficher quoi que ce soit, donc cette fonction ne revérifie
 * pas le drapeau elle-même — contrairement à `listPublicEvents`, dont les appelants (page et
 * route publiques) n'ont aucune autre vérification en amont et portent donc un enjeu de
 * confidentialité différent.
 */
const resolveUpcomingEvents = cache(
  async (
    schoolId: string,
    viewer: EventViewer,
    fromMs: number,
    take: number,
    gw: typeof eventGateway
  ) => gw.listUpcoming(schoolId, visibleEventVisibilities(viewer), new Date(fromMs), take)
)

export function listUpcomingEvents(
  schoolId: string,
  viewer: EventViewer,
  gw: typeof eventGateway = eventGateway,
  now: Date = new Date(),
  take: number = DEFAULT_TAKE
) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return resolveUpcomingEvents(schoolId, viewer, from.getTime(), take, gw)
}
