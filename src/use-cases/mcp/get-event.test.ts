import { describe, expect, it, vi } from 'vitest'
import { getEventFromMcp } from './get-event'

type ReadGw = NonNullable<Parameters<typeof getEventFromMcp>[2]>
type ConfigGw = NonNullable<Parameters<typeof getEventFromMcp>[3]>

const scope = { schoolId: 'school-1' }
const eventId = '123e4567-e89b-12d3-a456-426614174000'

function setup(event: unknown, flag = 'true') {
  const readGw = { getEvent: vi.fn().mockResolvedValue(event) }
  const configGw = { get: vi.fn().mockResolvedValue({ value: flag }) }
  const run = (input: Record<string, unknown>) =>
    getEventFromMcp(
      scope,
      input as never,
      readGw as unknown as ReadGw,
      configGw as unknown as ConfigGw
    )
  return { readGw, run }
}

describe('getEventFromMcp', () => {
  it('reads the event in the key school only', async () => {
    const { readGw, run } = setup({ id: eventId, title: 'Fête' })

    const result = await run({ id: eventId, schoolId: 'other-school' })

    expect(readGw.getEvent).toHaveBeenCalledWith('school-1', eventId)
    expect(result).toEqual({ id: eventId, title: 'Fête' })
  })

  it('answers notFound for an unknown or archived event', async () => {
    const { run } = setup(null)

    expect(await run({ id: eventId })).toBe('notFound')
  })

  it('refuses a malformed id and a disabled school before reading', async () => {
    const malformed = setup(null)
    expect(await malformed.run({ id: 'event-1' })).toBe('validationError')
    expect(malformed.readGw.getEvent).not.toHaveBeenCalled()

    const disabled = setup(null, 'false')
    expect(await disabled.run({ id: eventId })).toBe('notConfigured')
    expect(disabled.readGw.getEvent).not.toHaveBeenCalled()
  })
})
