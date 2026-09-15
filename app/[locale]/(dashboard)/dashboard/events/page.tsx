import { Breadcrumbs, Card, type Column, DataTable, EmptyState } from '@peaklab/ui'
import { CalendarHeart } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EventCategoryLabel, EventStatusBadge, EventVisibilityLabel } from '@/features/enums'
import type { EventCategory } from '@/generated/prisma/client'
import { formatEventDate } from '@/lib/date'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { ArchiveEventDialog } from './_components/archive-event-dialog'
import { CreateEventDialog } from './_components/create-event-dialog'
import { EditEventDialog } from './_components/edit-event-dialog'
import { EVENT_CATEGORY_VALUES } from './_components/event-enum-values'
import { EventsFilters } from './_components/events-filters'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ year?: string; category?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.events.title')
}

export default async function EventsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { year, category } = await searchParams
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()

  const eventsConfig = await db.config.findFirst({
    where: { schoolId, name: EVENTS_CONFIG_KEY, isActive: true },
    select: { value: true },
  })
  // Doctrine du dépôt : on cache la fonctionnalité désactivée, on n'affiche jamais un
  // écran qui n'annonce que son indisponibilité (cf. teachers/page.tsx).
  if (eventsConfig?.value !== 'true') notFound()

  const t = await getTranslations('dashboard.pages.events')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const selectedCategory =
    category && (EVENT_CATEGORY_VALUES as string[]).includes(category)
      ? (category as EventCategory)
      : undefined
  const selectedYear = year && /^\d{4}$/.test(year) ? Number(year) : undefined

  // Les filtres année/catégorie sont appliqués ici, côté serveur, jamais recalculés dans
  // le navigateur : `RichDataTable` n'aurait pas cette garantie sur sa prop `data`, donc
  // cette liste utilise le `DataTable` simple, sans état client.
  const [allEvents, events] = await Promise.all([
    db.event.findMany({
      where: { schoolId, isActive: true },
      select: { startAt: true },
    }),
    db.event.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(selectedYear
          ? {
              startAt: {
                gte: new Date(Date.UTC(selectedYear, 0, 1)),
                lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
              },
            }
          : {}),
      },
      include: { images: { orderBy: { position: 'asc' } } },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const years = Array.from(new Set(allEvents.map((event) => event.startAt.getUTCFullYear()))).sort(
    (a, b) => b - a
  )

  // `events` est trié par `startAt` croissant : deux événements du même mois sont donc
  // toujours adjacents, ce qui rend un index de recherche superflu ici.
  const groups: { key: string; label: string; events: typeof events }[] = []
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

  const columns: Column<(typeof events)[0]>[] = [
    {
      key: 'event',
      header: t('columns.event'),
      className: 'font-medium text-graphite',
      render: (event) => (
        <div className={event.status === 'CANCELLED' ? 'line-through opacity-60' : undefined}>
          <p>{event.title}</p>
          {event.location && (
            <p className="text-xs font-normal text-graphite-600">{event.location}</p>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: t('columns.date'),
      className: 'text-graphite',
      render: (event) => (
        <span className={event.status === 'CANCELLED' ? 'line-through opacity-60' : undefined}>
          {formatEventDate(event, locale)}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('columns.category'),
      className: 'text-graphite',
      render: (event) => <EventCategoryLabel category={event.category} />,
    },
    {
      key: 'visibility',
      header: t('columns.visibility'),
      className: 'text-graphite',
      render: (event) => <EventVisibilityLabel visibility={event.visibility} />,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (event) => <EventStatusBadge status={event.status} />,
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (event) => (
        <div className="flex justify-end gap-2">
          <EditEventDialog event={event} />
          <ArchiveEventDialog eventId={event.id} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('events') },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">{t('description')}</p>
        </div>
        <CreateEventDialog />
      </div>

      <EventsFilters years={years} />

      {events.length === 0 ? (
        <EmptyState icon={CalendarHeart} title={t('empty')} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.key} className="overflow-hidden rounded border border-alabaster-700">
              <div className="border-b border-alabaster-700 bg-alabaster-900 px-4 py-3">
                <h2 className="text-sm font-semibold capitalize text-graphite">{group.label}</h2>
              </div>
              <DataTable
                data={group.events}
                columns={columns}
                getRowKey={(event) => event.id}
                emptyMessage={t('empty')}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
