import { Breadcrumbs, Card, type Column, DataTable, EmptyState } from '@peaklab/ui'
import { CalendarHeart } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { eventPeriodBounds, shiftEventToNextYear } from '@/domain/event'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { EventCategoryLabel, EventStatusBadge, EventVisibilityLabel } from '@/features/enums'
import { schoolGateway } from '@/gateways/school-gateway'
import { formatEventDate } from '@/lib/date'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateEventDialog } from './_components/create-event-dialog'
import { EventActionsMenu } from './_components/event-actions-menu'
import { isEventCategory } from './_components/event-enum-values'
import { EventsFilters } from './_components/events-filters'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.events.title')
}

export default async function EventsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { category } = await searchParams
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()

  const eventsConfig = await db.config.findFirst({
    where: { schoolId, name: EVENTS_CONFIG_KEY, isActive: true },
    select: { value: true },
  })
  // Doctrine du dépôt : on cache la fonctionnalité désactivée, on n'affiche jamais un
  // écran qui n'annonce que son indisponibilité (cf. teachers/page.tsx).
  if (eventsConfig?.value !== 'true') notFound()

  const [school, mealsEnabled] = await Promise.all([
    schoolGateway.findActiveById(schoolId),
    isMealsEnabled(schoolId),
  ])
  if (!school) notFound()

  const t = await getTranslations('dashboard.pages.events')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const selectedCategory = isEventCategory(category) ? category : undefined
  // La liste suit la période choisie dans l'en-tête, comme classes et paiements. Une école
  // sans période voit tous ses événements plutôt qu'une liste vide inexplicable.
  const selectedPeriod = await getSelectedPeriod(schoolId)
  const bounds = selectedPeriod ? eventPeriodBounds(selectedPeriod) : null

  // Période et catégorie sont appliquées ici, côté serveur, jamais recalculées dans le
  // navigateur : `RichDataTable` n'aurait pas cette garantie sur sa prop `data`, donc cette
  // liste utilise le `DataTable` simple, sans état client.
  const events = await db.event.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(selectedCategory ? { category: selectedCategory } : {}),
      ...(bounds
        ? {
            startAt: { lt: bounds.until },
            OR: [{ endAt: { gte: bounds.from } }, { endAt: null, startAt: { gte: bounds.from } }],
          }
        : {}),
    },
    include: { images: { orderBy: { position: 'asc' } } },
    orderBy: { startAt: 'asc' },
  })

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
        <EventActionsMenu
          event={event}
          schoolSlug={school.slug}
          mealsEnabled={mealsEnabled}
          nextStartLabel={formatEventDate(
            { allDay: event.allDay, ...shiftEventToNextYear(event) },
            locale
          )}
        />
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
        <CreateEventDialog mealsEnabled={mealsEnabled} />
      </div>

      <EventsFilters />

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title={selectedPeriod ? t('emptyInPeriod', { period: selectedPeriod.name }) : t('empty')}
        />
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
