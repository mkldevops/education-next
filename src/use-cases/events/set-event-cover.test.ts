import { beforeEach, describe, expect, it } from 'vitest'
import { setEventCover } from './set-event-cover'

type EventGw = Parameters<typeof setEventCover>[1]
type ConfigGw = Parameters<typeof setEventCover>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const eventId = '123e4567-e89b-12d3-a456-426614174000'
const coverId = '223e4567-e89b-12d3-a456-426614174000'
const secondId = '323e4567-e89b-12d3-a456-426614174000'
const thirdId = '423e4567-e89b-12d3-a456-426614174000'

class EventGatewaySpy {
  eventToReturn: { id: string; images: Array<{ id: string }> } | null = {
    id: eventId,
    images: [{ id: coverId }, { id: secondId }, { id: thirdId }],
  }
  reorderCalls: Array<{ schoolId: string; eventId: string; orderedImageIds: string[] }> = []

  async findById() {
    return this.eventToReturn
  }

  async reorderImages(reorderSchoolId: string, reorderEventId: string, orderedImageIds: string[]) {
    this.reorderCalls.push({ schoolId: reorderSchoolId, eventId: reorderEventId, orderedImageIds })
    return [] as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('setEventCover', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  const run = (imageId: string) =>
    setEventCover(
      { schoolId, eventId, imageId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

  it('fails validation when the image id is invalid', async () => {
    expect(await run('nope')).toBe('validationError')
    expect(eventGateway.reorderCalls).toEqual([])
  })

  it('refuses when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    expect(await run(thirdId)).toBe('notConfigured')
  })

  it('fails when the event does not exist in the school', async () => {
    eventGateway.eventToReturn = null

    expect(await run(thirdId)).toBe('notFound')
  })

  it('fails when the image does not belong to the event', async () => {
    expect(await run('523e4567-e89b-12d3-a456-426614174000')).toBe('notFound')
    expect(eventGateway.reorderCalls).toEqual([])
  })

  it('moves the chosen image first and keeps the others in order', async () => {
    await run(thirdId)

    expect(eventGateway.reorderCalls).toEqual([
      { schoolId, eventId, orderedImageIds: [thirdId, coverId, secondId] },
    ])
  })
})
