import { beforeEach, describe, expect, it } from 'vitest'
import { archiveEvent } from './archive-event'

type EventGw = Parameters<typeof archiveEvent>[1]
type ConfigGw = Parameters<typeof archiveEvent>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const eventId = '123e4567-e89b-12d3-a456-426614174000'

class EventGatewaySpy {
  eventToReturn: { id: string } | null = { id: eventId }
  archiveCalls: Array<{ schoolId: string; id: string }> = []

  async findById() {
    return this.eventToReturn
  }

  async archive(archiveSchoolId: string, id: string) {
    this.archiveCalls.push({ schoolId: archiveSchoolId, id })
    return { id, isActive: false } as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('archiveEvent', () => {
  let eventGateway: EventGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    eventGateway = new EventGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when the id is invalid', async () => {
    const result = await archiveEvent(
      { schoolId, id: 'nope' },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to archive an event when events are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await archiveEvent(
      { schoolId, id: eventId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
    expect(eventGateway.archiveCalls).toEqual([])
  })

  it('fails when the event does not exist in the school', async () => {
    eventGateway.eventToReturn = null

    const result = await archiveEvent(
      { schoolId, id: eventId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('archives an existing event', async () => {
    const result = await archiveEvent(
      { schoolId, id: eventId },
      eventGateway as unknown as EventGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('isActive', false)
    expect(eventGateway.archiveCalls).toEqual([{ schoolId, id: eventId }])
  })
})
