import { cache } from 'react'
import { resolveEventPageAccess } from '@/domain/event'
import { eventGateway } from '@/gateways/event-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { getAuthorizedSchools } from '@/lib/school-context'
import { isEventsEnabled } from '@/use-cases/events/is-events-enabled'

/**
 * Événement affichable à l'adresse publique, ou `null` pour une 404.
 *
 * Une école désactivée, des événements éteints ou un événement archivé répondent tous
 * `null` : la page ne dit jamais pourquoi elle n'existe pas. La session n'est lue que si
 * l'événement n'est pas public — un visiteur anonyme ne coûte aucune résolution de rôle.
 *
 * Mémoïsé pour le rendu : `generateMetadata` et la page partagent la même résolution.
 */
export const resolvePublicEvent = cache(async (schoolSlug: string, eventSlug: string) => {
  const school = await schoolGateway.findBySlug(schoolSlug)
  if (!school?.isActive) return null

  if (!(await isEventsEnabled(school.id))) return null

  const event = await eventGateway.findBySlugWithImages(school.id, eventSlug)
  if (!event) return null

  let access = resolveEventPageAccess(event, false)
  if (access === 'hidden') {
    const schools = await getAuthorizedSchools()
    const isAdmin = schools.some((candidate) => candidate.id === school.id && candidate.isAdmin)
    access = resolveEventPageAccess(event, isAdmin)
  }
  if (access === 'hidden') return null

  return { schoolId: school.id, event, access }
})
