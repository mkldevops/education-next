import { beforeEach, describe, expect, it } from 'vitest'
import { removeEventImage } from './remove-event-image'

type EventGw = Parameters<typeof removeEventImage>[1]
type ConfigGw = Parameters<typeof removeEventImage>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const eventId = '123e4567-e89b-12d3-a456-426614174000'
const imageId = '223e4567-e89b-12d3-a456-426614174000'

class EventGatewaySpy {
  eventToReturn: { id: string; images: Array<{ id: string }> } | null = {
    id: eventId,
    images: [{ id: imageId }],
  }
  removeCalls: Array<{ schoolId: string; eventId: string; imageId: string }> = []

  async findById() {
    return this.eventToReturn
  }

  async removeImage(removeSchoolId: string, removeEventId: string, removeImageId: string) {
    this.removeCalls.push({
      schoolId: removeSchoolId,
      eventId: removeEventId,
      imageId: removeImageId,
    })
    return [] as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('removeEventImage', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when the image id is invalid', async () => {
    const result = await removeEventImage(
      { schoolId, eventId, imageId: 'nope' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to remove an image when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await removeEventImage(
      { schoolId, eventId, imageId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
  })

  it('fails when the event does not exist in the school', async () => {
    eventGateway.eventToReturn = null

    const result = await removeEventImage(
      { schoolId, eventId, imageId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('fails when the image does not belong to the event', async () => {
    eventGateway.eventToReturn = { id: eventId, images: [{ id: 'another-image' }] }

    const result = await removeEventImage(
      { schoolId, eventId, imageId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('removes an image that belongs to the event', async () => {
    await removeEventImage(
      { schoolId, eventId, imageId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(eventGateway.removeCalls).toEqual([{ schoolId, eventId, imageId }])
  })
})
