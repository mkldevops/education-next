import { describe, expect, it, vi } from 'vitest'
import { listEventsFromMcp } from './list-events'

type ReadGw = NonNullable<Parameters<typeof listEventsFromMcp>[2]>
type ConfigGw = NonNullable<Parameters<typeof listEventsFromMcp>[3]>

const scope = { schoolId: 'school-1' }

function setup(rows: unknown[] = [], flag = 'true') {
  const readGw = { listEvents: vi.fn().mockResolvedValue(rows) }
  const configGw = { get: vi.fn().mockResolvedValue({ value: flag }) }
  const run = (input: Record<string, unknown>) =>
    listEventsFromMcp(
      scope,
      input as never,
      readGw as unknown as ReadGw,
      configGw as unknown as ConfigGw
    )
  return { readGw, configGw, run }
}

describe('listEventsFromMcp', () => {
  it('reads the key school with inclusive day bounds and one extra row', async () => {
    const { readGw, run } = setup()

    await run({ from: '2026-12-01', to: '2026-12-31', status: 'DRAFT', limit: 10 })

    expect(readGw.listEvents).toHaveBeenCalledWith('school-1', {
      from: new Date('2026-12-01T00:00:00.000Z'),
      before: new Date('2027-01-01T00:00:00.000Z'),
      status: 'DRAFT',
      take: 11,
    })
  })

  it('leaves the other side open when only one bound is given', async () => {
    const { readGw, run } = setup()

    await run({ from: '2026-12-01' })
    await run({ to: '2026-12-31' })

    expect(readGw.listEvents.mock.calls[0][1]).toMatchObject({
      from: new Date('2026-12-01T00:00:00.000Z'),
      before: undefined,
    })
    expect(readGw.listEvents.mock.calls[1][1]).toMatchObject({
      from: undefined,
      before: new Date('2027-01-01T00:00:00.000Z'),
    })
  })

  it('caps the page at 50 by default and says when it was truncated', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({ id: `event-${index}` }))
    const { readGw, run } = setup(rows)

    const result = await run({})

    expect(readGw.listEvents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ take: 51 })
    )
    expect(result).toMatchObject({ hasMore: true })
    expect((result as { events: unknown[] }).events).toHaveLength(50)
  })

  it('reports a complete page', async () => {
    const { run } = setup([{ id: 'event-1' }])

    expect(await run({})).toEqual({ events: [{ id: 'event-1' }], hasMore: false })
  })

  it('refuses a limit above 100 and a reversed range before reading', async () => {
    const { readGw, run } = setup()

    expect(await run({ limit: 101 })).toBe('validationError')
    expect(await run({ from: '2026-12-31', to: '2026-12-01' })).toBe('invalidDateRange')
    expect(readGw.listEvents).not.toHaveBeenCalled()
  })

  it('refuses with notConfigured when the school has not enabled events', async () => {
    const { readGw, configGw, run } = setup([], 'false')

    expect(await run({})).toBe('notConfigured')
    expect(configGw.get).toHaveBeenCalledWith('school-1', 'events_enabled')
    expect(readGw.listEvents).not.toHaveBeenCalled()
  })
})
