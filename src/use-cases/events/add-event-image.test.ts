import { beforeEach, describe, expect, it } from 'vitest'
import { addEventImage } from './add-event-image'

type EventGw = Parameters<typeof addEventImage>[1]
type ConfigGw = Parameters<typeof addEventImage>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const eventId = '123e4567-e89b-12d3-a456-426614174000'

class EventGatewaySpy {
  eventToReturn: { id: string } | null = { id: eventId }
  imageCount = 0
  addedSchoolId: string | null = null
  addedData: unknown = null

  async findById() {
    return this.eventToReturn
  }

  async countImages() {
    return this.imageCount
  }

  async addImage(addSchoolId: string, data: unknown) {
    this.addedSchoolId = addSchoolId
    this.addedData = data
    return { id: 'image-1', ...(data as object) } as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('addEventImage', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when the storage key is missing', async () => {
    const result = await addEventImage(
      { schoolId, eventId, storageKey: '' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to attach an image when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await addEventImage(
      { schoolId, eventId, storageKey: 'events/school-1/a.png' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
  })

  it('fails when the event does not exist in the school', async () => {
    eventGateway.eventToReturn = null

    const result = await addEventImage(
      { schoolId, eventId, storageKey: 'events/school-1/a.png' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('refuses a 7th image once the event already carries the maximum of 6', async () => {
    eventGateway.imageCount = 6

    const result = await addEventImage(
      { schoolId, eventId, storageKey: 'events/school-1/g.png' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('tooManyImages')
  })

  it('accepts the 6th image and positions it after the existing ones', async () => {
    eventGateway.imageCount = 5

    const result = await addEventImage(
      { schoolId, eventId, storageKey: 'events/school-1/f.png' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('id', 'image-1')
    expect(eventGateway.addedSchoolId).toBe(schoolId)
    expect(eventGateway.addedData).toMatchObject({
      eventId,
      storageKey: 'events/school-1/f.png',
      position: 5,
    })
  })
})
