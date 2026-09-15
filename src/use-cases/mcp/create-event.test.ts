import { describe, expect, it, vi } from 'vitest'
import { createEvent } from '@/use-cases/events/create-event'
import { createEventFromMcp } from './create-event'

type Create = NonNullable<Parameters<typeof createEventFromMcp>[2]>
type ConfigGw = Parameters<typeof createEvent>[2]

const scope = { schoolId: 'school-1' }

const created = {
  id: 'event-1',
  schoolId: 'school-1',
  slug: 'fete-de-l-ecole',
  title: "Fête de l'école",
  summary: null,
  description: null,
  category: 'CELEBRATION',
  visibility: 'MEMBERS',
  status: 'DRAFT',
  allDay: true,
  startAt: new Date('2026-12-03T00:00:00.000Z'),
  endAt: null,
  location: null,
  announceDaysBefore: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const run = (input: Record<string, unknown>, create: Create) =>
  createEventFromMcp(scope, input as never, create)

describe('createEventFromMcp', () => {
  it('delegates to createEvent with the key school and a day read as all-day', async () => {
    const create = vi.fn().mockResolvedValue(created)

    const result = await run(
      { title: "Fête de l'école", category: 'CELEBRATION', startAt: '2026-12-03', schoolId: 'x' },
      create
    )

    expect(create).toHaveBeenCalledWith({
      title: "Fête de l'école",
      category: 'CELEBRATION',
      schoolId: 'school-1',
      allDay: true,
      startAt: new Date('2026-12-03T00:00:00.000Z'),
      endAt: null,
    })
    expect(result).toMatchObject({ id: 'event-1', status: 'DRAFT' })
    expect(result).not.toHaveProperty('schoolId')
  })

  it('keeps the dictated wall-clock hour of a timed event', async () => {
    const create = vi.fn().mockResolvedValue({ ...created, allDay: false })

    await run(
      {
        title: 'Réunion parents',
        category: 'MEETING',
        startAt: '2026-12-03T18:00',
        endAt: '2026-12-03T20:00:00',
      },
      create
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        allDay: false,
        startAt: new Date('2026-12-03T18:00:00.000Z'),
        endAt: new Date('2026-12-03T20:00:00.000Z'),
      })
    )
  })

  it('refuses a timestamp carrying an offset, which is an instant rather than a wall clock', async () => {
    const create = vi.fn()

    const result = await run(
      { title: 'Réunion', category: 'MEETING', startAt: '2026-12-03T18:00:00+01:00' },
      create
    )

    expect(result).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('never accepts a status: a dictated event is born a draft', async () => {
    const create = vi.fn().mockResolvedValue(created)

    await run(
      { title: 'Fête', category: 'CELEBRATION', startAt: '2026-12-03', status: 'PUBLISHED' },
      create
    )

    expect(create.mock.calls[0][0]).not.toHaveProperty('status')
  })

  it('refuses with the server action discriminant when events_enabled is off', async () => {
    const eventGw = { findBySlug: vi.fn(), create: vi.fn() }
    const configGw = { get: vi.fn().mockResolvedValue({ value: 'false' }) }
    const create: Create = (input) =>
      createEvent(input, eventGw as never, configGw as unknown as ConfigGw)

    const result = await run(
      { title: 'Fête', category: 'CELEBRATION', startAt: '2026-12-03' },
      create
    )

    expect(result).toBe('notConfigured')
    expect(configGw.get).toHaveBeenCalledWith('school-1', 'events_enabled')
    expect(eventGw.create).not.toHaveBeenCalled()
  })
})
