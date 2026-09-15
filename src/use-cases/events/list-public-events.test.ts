import { describe, expect, it, vi } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import type { eventGateway } from '@/gateways/event-gateway'
import type { schoolGateway } from '@/gateways/school-gateway'
import { listPublicEvents } from './list-public-events'

const school = { id: 'school-1', name: 'École du Parc', slug: 'ecole-du-parc', isActive: true }

const schoolReturning = (result: typeof school | null): typeof schoolGateway =>
  ({ findBySlug: vi.fn(async () => result) }) as unknown as typeof schoolGateway

const configReturning = (value: string | null): typeof configGateway =>
  ({
    get: vi.fn(async () => (value === null ? null : { name: 'events_enabled', value })),
  }) as unknown as typeof configGateway

const eventsReturning = (events: unknown[]): typeof eventGateway =>
  ({ listPublic: vi.fn(async () => events) }) as unknown as typeof eventGateway

const baseEvent = {
  id: 'event-1',
  title: 'Fête de fin d’année',
  visibility: 'PUBLIC' as const,
  status: 'PUBLISHED' as const,
}

describe('listPublicEvents', () => {
  it('is notFound for an unknown slug', async () => {
    await expect(
      listPublicEvents(
        'unknown',
        schoolReturning(null),
        configReturning('true'),
        eventsReturning([])
      )
    ).resolves.toBe('notFound')
  })

  it('is notFound for a deactivated school, indistinguishable from an unknown one', async () => {
    await expect(
      listPublicEvents(
        'ecole-du-parc',
        schoolReturning({ ...school, isActive: false }),
        configReturning('true'),
        eventsReturning([])
      )
    ).resolves.toBe('notFound')
  })

  it('is notConfigured when events are disabled for the school', async () => {
    await expect(
      listPublicEvents(
        'ecole-du-parc',
        schoolReturning(school),
        configReturning(null),
        eventsReturning([])
      )
    ).resolves.toBe('notConfigured')
  })

  it('excludes MEMBERS, STAFF and DRAFT even if the upstream query already should have', async () => {
    const events = [
      baseEvent,
      { ...baseEvent, id: 'event-2', visibility: 'MEMBERS' },
      { ...baseEvent, id: 'event-3', visibility: 'STAFF' },
      { ...baseEvent, id: 'event-4', status: 'DRAFT' },
    ]

    const result = await listPublicEvents(
      'ecole-du-parc',
      schoolReturning(school),
      configReturning('true'),
      eventsReturning(events)
    )

    if (result === 'notFound' || result === 'notConfigured') throw new Error('expected a result')
    expect(result.events.map((event) => event.id)).toEqual(['event-1'])
    expect(result.school).toEqual({ id: 'school-1', name: 'École du Parc', slug: 'ecole-du-parc' })
  })

  it('keeps a cancelled public event visible rather than dropping it like an archived one', async () => {
    const events = [{ ...baseEvent, id: 'event-5', status: 'CANCELLED' }]

    const result = await listPublicEvents(
      'ecole-du-parc',
      schoolReturning(school),
      configReturning('true'),
      eventsReturning(events)
    )

    if (result === 'notFound' || result === 'notConfigured') throw new Error('expected a result')
    expect(result.events.map((event) => event.id)).toEqual(['event-5'])
  })
})
