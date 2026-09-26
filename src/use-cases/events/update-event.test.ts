import { beforeEach, describe, expect, it } from 'vitest'
import { updateEvent } from './update-event'

type EventGw = Parameters<typeof updateEvent>[1]
type ConfigGw = Parameters<typeof updateEvent>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const eventId = '123e4567-e89b-12d3-a456-426614174000'

type EventFixture = {
  id: string
  status: string
  title: string
  slug: string
  allDay: boolean
  startAt: Date
  endAt: Date | null
  images: never[]
}

function baseEvent(): EventFixture {
  return {
    id: eventId,
    status: 'DRAFT',
    title: 'Réunion de rentrée',
    slug: 'reunion-de-rentree',
    allDay: true,
    startAt: new Date('2026-09-01T00:00:00.000Z'),
    endAt: null,
    images: [],
  }
}

class EventGatewaySpy {
  eventToReturn: EventFixture | null = baseEvent()
  existingSlug: { id: string; slug: string } | null = null
  updatedSchoolId: string | null = null
  updatedId: string | null = null
  updatedData: unknown = null
  expectedStatus: string | undefined = undefined

  async findById() {
    return this.eventToReturn
  }

  async findBySlug(_schoolId: string, slug: string) {
    return this.existingSlug?.slug === slug ? this.existingSlug : null
  }

  async update(updateSchoolId: string, id: string, data: unknown, expectedStatus?: string) {
    this.expectedStatus = expectedStatus
    this.updatedSchoolId = updateSchoolId
    this.updatedId = id
    this.updatedData = data
    return { id, ...(data as object) } as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('updateEvent', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when the id is invalid', async () => {
    const result = await updateEvent(
      { schoolId, id: 'bad-id', title: 'x' } as never,
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to update an event when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await updateEvent(
      { schoolId, id: eventId, title: 'Nouvelle réunion' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
  })

  it('fails when the event does not exist in the school', async () => {
    eventGateway.eventToReturn = null

    const result = await updateEvent(
      { schoolId, id: eventId, title: 'Nouvelle réunion' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('rejects an end date before the start date', async () => {
    const result = await updateEvent(
      { schoolId, id: eventId, endAt: new Date('2026-08-01T00:00:00.000Z') },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('invalidDateRange')
  })

  it('leaves the slug untouched when the title does not change', async () => {
    await updateEvent(
      { schoolId, id: eventId, summary: 'Nouveau résumé' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(eventGateway.updatedData).not.toHaveProperty('slug')
  })

  it('recomputes the slug only when the title changes', async () => {
    await updateEvent(
      { schoolId, id: eventId, title: 'Portes ouvertes' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(eventGateway.updatedData).toMatchObject({ slug: 'portes-ouvertes' })
  })

  it('does not collide with its own current slug', async () => {
    // Le titre change de ponctuation mais se réduit au même slug : pas de recherche
    // d'unicité, donc pas de faux 'slugTaken' contre soi-même.
    eventGateway.existingSlug = { id: eventId, slug: 'reunion-de-rentree' }

    const result = await updateEvent(
      { schoolId, id: eventId, title: 'Réunion de Rentrée !' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).not.toBe('slugTaken')
    expect(eventGateway.updatedData).not.toHaveProperty('slug')
  })

  it('refuses a new title whose slug is already taken by another event', async () => {
    eventGateway.existingSlug = { id: 'another-event', slug: 'portes-ouvertes' }

    const result = await updateEvent(
      { schoolId, id: eventId, title: 'Portes ouvertes' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('slugTaken')
  })

  it('writes without a status condition for the dashboard', async () => {
    await updateEvent(
      { schoolId, id: eventId, title: 'Portes ouvertes' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(eventGateway.expectedStatus).toBeUndefined()
  })

  it('refuses a published event when restricted to drafts', async () => {
    eventGateway.eventToReturn = { ...baseEvent(), status: 'PUBLISHED' }

    const result = await updateEvent(
      { schoolId, id: eventId, title: 'Portes ouvertes' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw,
      { draftOnly: true }
    )

    expect(result).toBe('notDraft')
    expect(eventGateway.updatedData).toBeNull()
  })

  it('conditions the draft-only write on the draft status, so a concurrent publish fails it', async () => {
    await updateEvent(
      { schoolId, id: eventId, title: 'Portes ouvertes' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw,
      { draftOnly: true }
    )

    expect(eventGateway.expectedStatus).toBe('DRAFT')
  })
})
