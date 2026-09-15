import { type NextRequest, NextResponse } from 'next/server'
import { buildEventsIcsFeed, type IcsEvent } from '@/domain/event-ics'
import { listPublicEvents } from '@/use-cases/events/list-public-events'

// Même doctrine que `/api/media/[...key]` : une école inconnue ou dont `events_enabled`
// est éteint répond 404, jamais une réponse qui n'annoncerait que son indisponibilité.
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const result = await listPublicEvents(slug)

  if (result === 'notFound' || result === 'notConfigured') {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }

  const events: IcsEvent[] = result.events.map((event) => ({
    id: event.id,
    title: event.title,
    summary: event.summary,
    description: event.description,
    location: event.location,
    // `filterVisibleEvents` a déjà exclu DRAFT en amont : ce statut ne peut pas survenir
    // ici. Le mapper vers PUBLISHED plutôt que planter préserve le reste du flux si
    // l'invariant amont était un jour violé par erreur.
    status: event.status === 'CANCELLED' ? 'CANCELLED' : 'PUBLISHED',
    allDay: event.allDay,
    startAt: event.startAt,
    endAt: event.endAt,
    updatedAt: event.updatedAt,
  }))

  const body = buildEventsIcsFeed({ slug: result.school.slug, name: result.school.name }, events)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${result.school.slug}-events.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
