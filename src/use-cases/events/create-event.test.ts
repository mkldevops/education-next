import { beforeEach, describe, expect, it } from 'vitest'
import { createEvent } from './create-event'

type EventGw = Parameters<typeof createEvent>[1]
type ConfigGw = Parameters<typeof createEvent>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'

class EventGatewaySpy {
  existingSlug: { id: string; slug: string } | null = null
  createdSchoolId: string | null = null
  createdData: unknown = null

  async findBySlug(_schoolId: string, slug: string) {
    return this.existingSlug?.slug === slug ? this.existingSlug : null
  }

  async create(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return { id: 'event-1', ...(data as object) } as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

const baseInput = {
  schoolId,
  title: 'Réunion de rentrée',
  category: 'MEETING' as const,
  startAt: new Date('2026-09-01T08:00:00.000Z'),
}

describe('createEvent', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when the title is blank', async () => {
    const result = await createEvent(
      { ...baseInput, title: '' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to create an event when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await createEvent(
      baseInput,
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
  })

  it('rejects an end date before the start date', async () => {
    const result = await createEvent(
      { ...baseInput, endAt: new Date('2026-08-31T08:00:00.000Z') },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('invalidDateRange')
  })

  it('refuses a title that slugifies to an already active slug', async () => {
    eventGateway.existingSlug = { id: 'existing-event', slug: 'reunion-de-rentree' }

    const result = await createEvent(
      baseInput,
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('slugTaken')
  })

  it('creates the event with a slug computed from the title', async () => {
    const result = await createEvent(
      baseInput,
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('id', 'event-1')
    expect(eventGateway.createdSchoolId).toBe(schoolId)
    expect(eventGateway.createdData).toMatchObject({
      title: 'Réunion de rentrée',
      slug: 'reunion-de-rentree',
      category: 'MEETING',
    })
  })

  it('snaps an all-day event to UTC midnight before saving', async () => {
    await createEvent(
      { ...baseInput, allDay: true, startAt: new Date('2026-09-01T22:00:00.000Z') },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(eventGateway.createdData).toMatchObject({
      startAt: new Date('2026-09-01T00:00:00.000Z'),
    })
  })
})
