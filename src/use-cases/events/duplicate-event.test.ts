import { beforeEach, describe, expect, it } from 'vitest'
import { duplicateEvent } from './duplicate-event'

type EventGw = Parameters<typeof duplicateEvent>[1]
type ConfigGw = Parameters<typeof duplicateEvent>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const sourceId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'

const source = {
  id: sourceId,
  schoolId,
  title: 'Fête de fin d’année',
  slug: 'fete-de-fin-d-annee',
  summary: 'Spectacle des classes',
  description: 'Rendez-vous dans la cour.',
  category: 'CELEBRATION' as const,
  visibility: 'PUBLIC' as const,
  status: 'PUBLISHED' as const,
  allDay: true,
  startAt: new Date('2026-12-03T00:00:00.000Z'),
  endAt: null,
  location: 'Cour de l’école',
  announceDaysBefore: 7,
  isActive: true,
  images: [{ id: 'image-1', storageKey: 'events/s/a.png', position: 0 }],
}

class EventGatewaySpy {
  sourceToReturn: typeof source | null = source
  existingSlugs = new Set([source.slug])
  created: { schoolId: string; data: Record<string, unknown> } | null = null
  updates = 0

  async findById(_schoolId: string, id: string) {
    return this.sourceToReturn?.id === id ? this.sourceToReturn : null
  }

  async findBySlug(_schoolId: string, slug: string) {
    return this.existingSlugs.has(slug) ? { id: sourceId, slug } : null
  }

  async create(createSchoolId: string, data: Record<string, unknown>) {
    this.created = { schoolId: createSchoolId, data }
    return { id: 'event-2', ...data } as never
  }

  async update() {
    this.updates += 1
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('duplicateEvent', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  const run = (title: string, id = sourceId) =>
    duplicateEvent(
      { schoolId, id, title },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('creates a draft one year later that keeps category and visibility', async () => {
    const result = await run('Fête de fin d’année 2027')

    expect(result).toMatchObject({ id: 'event-2' })
    expect(eventGateway.created?.schoolId).toBe(schoolId)
    expect(eventGateway.created?.data).toMatchObject({
      title: 'Fête de fin d’année 2027',
      slug: 'fete-de-fin-d-annee-2027',
      category: 'CELEBRATION',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      allDay: true,
      startAt: new Date('2027-12-03T00:00:00.000Z'),
      endAt: null,
      summary: 'Spectacle des classes',
      location: 'Cour de l’école',
      announceDaysBefore: 7,
    })
  })

  it('never copies images nor touches the source event', async () => {
    await run('Fête de fin d’année 2027')

    expect(eventGateway.created?.data).not.toHaveProperty('images')
    expect(eventGateway.updates).toBe(0)
  })

  it('refuses an unchanged title with the existing slugTaken discriminant', async () => {
    const result = await run(source.title)

    expect(result).toBe('slugTaken')
    expect(eventGateway.created).toBeNull()
  })

  it('refuses when events are not enabled, before reading the source', async () => {
    configGateway.configToReturn = { value: 'false' }
    eventGateway.sourceToReturn = null

    expect(await run('Fête 2027')).toBe('notConfigured')
  })

  it('answers notFound for an event outside the school or archived', async () => {
    eventGateway.sourceToReturn = null

    expect(await run('Fête 2027')).toBe('notFound')
  })

  it('fails validation on a blank title', async () => {
    expect(await run('   ')).toBe('validationError')
  })
})
