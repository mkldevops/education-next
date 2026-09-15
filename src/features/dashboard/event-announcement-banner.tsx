import { getLocale, getTranslations } from 'next-intl/server'
import { selectAnnouncedEvent } from '@/domain/event'
import { formatEventDate } from '@/lib/date'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'
import { isEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { listAnnounceableEvents } from '@/use-cases/events/list-announceable-events'
import { EventAnnouncementBannerClient } from './event-announcement-banner-client'

/**
 * Bandeau J-x (#326) : un seul, l'événement PUBLISHED le plus proche dont la fenêtre
 * `announceDaysBefore` est ouverte. Rendu dans le layout du tableau de bord, comme
 * `ImpersonationBanner` : visible de tout membre de l'école (ADMIN et PARENT), au même
 * titre que la carte « Prochains événements ». `/dashboard/events` reste réservé aux
 * administrateurs — ce bandeau et cette carte sont ce qui donne aux familles une vue sur
 * les événements sans y accéder.
 */
export async function EventAnnouncementBanner() {
  const context = await getSchoolContext()
  if (!context) return null

  const enabled = await isEventsEnabled(context.schoolId)
  if (!enabled) return null

  const viewer = isActiveSchoolAdmin(context) ? 'STAFF' : 'MEMBER'
  const events = await listAnnounceableEvents(context.schoolId, viewer)
  const announced = selectAnnouncedEvent(events, new Date())
  if (!announced) return null

  const locale = await getLocale()
  const t = await getTranslations('dashboard.eventAnnouncement')

  return (
    <EventAnnouncementBannerClient
      id={announced.id}
      updatedAt={announced.updatedAt.toISOString()}
      message={t('message', { title: announced.title, date: formatEventDate(announced, locale) })}
      dismissLabel={t('dismiss')}
    />
  )
}
