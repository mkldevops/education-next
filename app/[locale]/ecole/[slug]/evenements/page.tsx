import { buttonVariants, Card, EmptyState } from '@peaklab/ui'
import { CalendarHeart, CalendarPlus } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { EventCategoryLabel, EventStatusBadge } from '@/features/enums'
import { formatEventDate } from '@/lib/date'
import { getThemeConfigs } from '@/lib/theme-configs'
import { cn } from '@/lib/utils'
import { listPublicEvents, type PublicEvent } from '@/use-cases/events/list-public-events'

type Props = {
  params: Promise<{ locale: string; slug: string }>
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

export default async function PublicEventsPage({ params }: Props) {
  await connection()
  const { locale, slug } = await params
  setRequestLocale(locale)

  const result = await listPublicEvents(slug)
  if (result === 'notFound' || result === 'notConfigured') notFound()

  const { school, events } = result
  const [themeConfigs, t] = await Promise.all([
    getThemeConfigs(school.id),
    getTranslations('publicEvents'),
  ])
  const groups = groupByMonth(events, locale)

  return (
    <div className="min-h-screen bg-alabaster-900">
      {/* Le layout habille la page avec l'école du visiteur (souvent aucune) : celle du
          `slug` prime ici, déclarée après et donc gagnante sur `:root`. */}
      <ThemeProvider configs={themeConfigs} />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-medium text-foreground">{school.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-graphite">{t('title')}</h1>
          <p className="mt-2 text-graphite-600">{t('subtitle', { schoolName: school.name })}</p>
          <a
            href={`/api/schools/${school.slug}/events.ics`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4 inline-flex')}
          >
            <CalendarPlus className="h-4 w-4" />
            {t('subscribe')}
          </a>
        </header>

        {events.length === 0 ? (
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
                      className="flex gap-4 rounded border border-alabaster-700 bg-white p-4"
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
      </div>
    </div>
  )
}
