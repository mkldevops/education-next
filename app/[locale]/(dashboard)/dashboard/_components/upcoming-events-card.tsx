import { Card } from '@peaklab/ui'
import Image from 'next/image'
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
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        {canManage && (
          <Link
            href="/dashboard/events"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('manage')}
          </Link>
        )}
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-3">
              {event.images[0] && (
                <Image
                  src={`/api/media/${event.images[0].storageKey}`}
                  alt={event.images[0].alt ?? ''}
                  width={80}
                  height={60}
                  className="h-15 w-20 shrink-0 rounded-md border border-border object-cover"
                />
              )}
              <div
                className={cn(
                  'min-w-0 flex-1',
                  event.status === 'CANCELLED' && 'line-through opacity-60'
                )}
              >
                <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDate(event, locale)} ·{' '}
                  <EventCategoryLabel category={event.category} />
                </p>
              </div>
              <div className="shrink-0 self-start">
                <EventStatusBadge status={event.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
