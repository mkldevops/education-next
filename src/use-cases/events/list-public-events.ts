import { cache } from 'react'
import { filterVisibleEvents } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import type { Event, EventImage } from '@/generated/prisma/client'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'

export type PublicEvent = Event & { images: EventImage[] }

export type PublicEventsResult =
  | 'notFound'
  | 'notConfigured'
  | {
      school: { id: string; name: string; slug: string }
      events: PublicEvent[]
    }

/**
 * Mémoïsé pour la durée d'un rendu : `generateMetadata` (titre et image Open Graph) et le
 * corps de la page publique interrogent la même école dans la même requête, comme
 * `getSchoolContext`. La route ICS n'en bénéficie pas (requête indépendante), mais partage
 * la même fonction, donc « exactement la même projection » que la page.
 *
 * Le drapeau `events_enabled` est vérifié ici par `configGateway` directement, pas via
 * `isEventsEnabled` : comme `createEvent`/`updateEvent`, l'injection directe garde cette
 * fonction testable sans dépendre d'un autre module mémoïsé.
 */
const resolvePublicEvents = cache(
  async (
    slug: string,
    schoolGw: typeof schoolGateway,
    configGw: typeof configGateway,
    eventGw: typeof eventGateway
  ): Promise<PublicEventsResult> => {
    const school = await schoolGw.findBySlug(slug)
    if (!school?.isActive) return 'notFound'

    const config = await configGw.get(school.id, EVENTS_CONFIG_KEY)
    if (config?.value !== 'true') return 'notConfigured'

    const events = await eventGw.listPublic(school.id)

    return {
      school: { id: school.id, name: school.name, slug: school.slug },
      // Défense en profondeur : cf. commentaire de `filterVisibleEvents`.
      events: filterVisibleEvents(events, ['PUBLIC']),
    }
  }
)

export function listPublicEvents(
  slug: string,
  schoolGw: typeof schoolGateway = schoolGateway,
  configGw: typeof configGateway = configGateway,
  eventGw: typeof eventGateway = eventGateway
): Promise<PublicEventsResult> {
  return resolvePublicEvents(slug, schoolGw, configGw, eventGw)
}
