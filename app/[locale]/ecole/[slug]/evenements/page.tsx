import { Archive, ArrowLeft, CalendarHeart, CalendarPlus, Printer } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { eventPeriodBounds } from '@/domain/event'
import { buildEventCalendar, eventCalendarRange } from '@/domain/event-calendar'
import { getDefaultPeriod } from '@/features/dashboard/period'
import { EventCategoryLabel, EventStatusBadge } from '@/features/enums'
import { EventsOverviewCalendar } from '@/features/events'
import { Link } from '@/i18n/routing'
import { formatEventDate } from '@/lib/date'
import { getThemeConfigs } from '@/lib/theme-configs'
import { cn } from '@/lib/utils'
import { listPublicEvents, type PublicEvent } from '@/use-cases/events/list-public-events'

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams?: Promise<{ archives?: string }>
}

/**
 * Image de partage Open Graph : la couverture (`position = 0`) de l'événement le plus
 * pertinent — le plus proche à venir en priorité, sinon le plus récemment passé plutôt que
 * de laisser la page sans image de partage. `events` est trié par `startAt` croissant.
 */
function pickShareImage(events: PublicEvent[]) {
  const now = Date.now()
  const upcoming = events.find((event) => event.startAt.getTime() >= now && event.images.length > 0)
  if (upcoming) return upcoming.images[0]

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.startAt.getTime() < now && event.images.length > 0) return event.images[0]
  }

  return undefined
}

/**
 * Même convention de regroupement que le tableau de bord admin
 * (`(dashboard)/dashboard/events/page.tsx`) : `events` trié par `startAt` croissant rend un
 * index de recherche superflu, deux événements du même mois sont toujours adjacents.
 */
function groupByMonth(events: PublicEvent[], locale: string) {
  const groups: { key: string; label: string; events: PublicEvent[] }[] = []

  for (const event of events) {
    const key = `${event.startAt.getUTCFullYear()}-${event.startAt.getUTCMonth()}`
    const lastGroup = groups.at(-1)
    if (lastGroup?.key === key) {
      lastGroup.events.push(event)
      continue
    }
    groups.push({
      key,
      label: new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(event.startAt),
      events: [event],
    })
  }

  return groups
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const result = await listPublicEvents(slug)

  if (result === 'notFound' || result === 'notConfigured') {
    const t = await getTranslations({ locale, namespace: 'errorPages' })
    return { title: t('404.title') }
  }

  const t = await getTranslations({ locale, namespace: 'publicEvents' })
  const title = t('metadata.title', { schoolName: result.school.name })
  const description = t('metadata.description', { schoolName: result.school.name })
  const image = pickShareImage(result.events)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: `/api/media/${image.storageKey}` }] } : {}),
    },
  }
}

export default async function PublicEventsPage({ params, searchParams }: Props) {
  await connection()
  const { locale, slug } = await params
  const { archives } = (await searchParams) ?? {}
  setRequestLocale(locale)

  const result = await listPublicEvents(slug)
  if (result === 'notFound' || result === 'notConfigured') notFound()

  const { school, events } = result
  const [themeConfigs, t, period] = await Promise.all([
    getThemeConfigs(school.id),
    getTranslations('publicEvents'),
    getDefaultPeriod(school.id),
  ])
  const bounds = period ? eventPeriodBounds(period) : null

  // La liste suit l'année scolaire en cours (et ce qui vient après) ; les années écoulées
  // passent derrière le lien « Archives », du plus récent au plus ancien.
  const isArchived = (event: PublicEvent) =>
    bounds !== null && (event.endAt ?? event.startAt) < bounds.from
  const archivedEvents = events.filter(isArchived)
  const showArchives = archives === '1' && archivedEvents.length > 0
  const listedEvents = showArchives
    ? [...archivedEvents].reverse()
    : events.filter((event) => !isArchived(event))
  const groups = groupByMonth(listedEvents, locale)

  const calendarEvents = events.filter((event) => event.status !== 'CANCELLED')
  const calendarRange = bounds ? eventCalendarRange(calendarEvents, bounds) : null
  const calendarMonths = calendarRange ? buildEventCalendar(calendarEvents, calendarRange) : []
  const hasCalendarEvents = calendarMonths.some((month) =>
    month.weeks.some((week) => week.some((day) => (day?.categories.length ?? 0) > 0))
  )
  const eventsPath = `/ecole/${school.slug}/evenements`

  return (
    <div className="min-h-screen bg-alabaster-900">
      {/* Le layout habille la page avec l'école du visiteur (souvent aucune) : celle du
          `slug` prime ici, déclarée après et donc gagnante sur `:root`. */}
      <ThemeProvider configs={themeConfigs} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-medium text-foreground">{school.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-graphite">{t('title')}</h1>
          <p className="mt-2 text-graphite-600">{t('subtitle', { schoolName: school.name })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/api/schools/${school.slug}/events.ics`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <CalendarPlus className="h-4 w-4" />
              {t('subscribe')}
            </a>
            {period && hasCalendarEvents && (
              <Link
                href={`/ecole/${school.slug}/calendrier`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Printer className="h-4 w-4" />
                {t('print')}
              </Link>
            )}
          </div>
        </header>

        {showArchives && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-graphite">{t('archivesTitle')}</h2>
            <Link href={eventsPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('backToCurrent')}
            </Link>
          </div>
        )}

        {!showArchives && period && hasCalendarEvents && (
          <Card className="mb-8 rounded border border-alabaster-700 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-graphite">
              {t('overview', { period: period.name })}
            </h2>
            <EventsOverviewCalendar
              months={calendarMonths}
              locale={locale}
              interactive={{ today: new Date(), pastMonthsLabel: t('showPastMonths') }}
            />
          </Card>
        )}

        {listedEvents.length === 0 ? (
          <EmptyState icon={CalendarHeart} title={t('empty')} />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 text-sm font-semibold capitalize text-graphite-600">
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.events.map((event) => (
                    <Card
                      key={event.id}
                      id={`event-${event.id}`}
                      className="flex scroll-mt-6 gap-4 rounded border border-alabaster-700 bg-white p-4 target:ring-2 target:ring-primary"
                    >
                      {event.images[0] && (
                        <Image
                          src={`/api/media/${event.images[0].storageKey}`}
                          alt={event.images[0].alt ?? ''}
                          width={96}
                          height={72}
                          className="h-18 w-24 shrink-0 rounded object-cover"
                        />
                      )}
                      <div
                        className={cn(
                          'min-w-0 flex-1',
                          event.status === 'CANCELLED' && 'line-through opacity-60'
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-graphite">{event.title}</p>
                          <EventStatusBadge status={event.status} />
                        </div>
                        <p className="text-sm text-graphite-600">
                          {formatEventDate(event, locale)}
                        </p>
                        {event.location && (
                          <p className="text-sm text-graphite-600">{event.location}</p>
                        )}
                        {event.summary && (
                          <p className="mt-1 text-sm text-graphite-700">{event.summary}</p>
                        )}
                        <p className="mt-1 text-xs text-graphite-500">
                          <EventCategoryLabel category={event.category} />
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!showArchives && archivedEvents.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href={`${eventsPath}?archives=1`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <Archive className="h-4 w-4" />
              {t('archives', { count: archivedEvents.length })}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
