import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import type { EventViewer } from '@/domain/event'
import { EventCategoryLabel, EventStatusBadge } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { formatEventDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { listUpcomingEvents } from '@/use-cases/events/list-upcoming-events'

type Props = {
  schoolId: string
  viewer: EventViewer
  locale: string
  canManage: boolean
}

const CARD_LIMIT = 5

/**
 * Lecture seule (#326) : ni action, ni lien d'édition — seul `/dashboard/events` (réservé
 * aux administrateurs) modifie un événement. `canManage` n'ajoute qu'un lien vers cet écran.
 */
export async function UpcomingEventsCard({ schoolId, viewer, locale, canManage }: Props) {
  const t = await getTranslations('dashboard.upcomingEvents')
  const events = (await listUpcomingEvents(schoolId, viewer)).slice(0, CARD_LIMIT)

  return (
    <Card className="rounded border border-alabaster-700 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-graphite">{t('title')}</h2>
        {canManage && (
          <Link
            href="/dashboard/events"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('manage')}
          </Link>
        )}
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-graphite-600">{t('empty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3">
              <div className={cn(event.status === 'CANCELLED' && 'line-through opacity-60')}>
                <p className="text-sm font-medium text-graphite">{event.title}</p>
                <p className="text-xs text-graphite-600">
                  {formatEventDate(event, locale)} ·{' '}
                  <EventCategoryLabel category={event.category} />
                </p>
              </div>
              <EventStatusBadge status={event.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
