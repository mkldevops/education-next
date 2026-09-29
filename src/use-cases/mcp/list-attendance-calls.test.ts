import { describe, expect, it, vi } from 'vitest'
import { listAttendanceCallsFromMcp } from './list-attendance-calls'

type ReadGw = NonNullable<Parameters<typeof listAttendanceCallsFromMcp>[2]>
type ConfigGw = NonNullable<Parameters<typeof listAttendanceCallsFromMcp>[3]>

const scope = { schoolId: 'school-1' }
const periodId = '11111111-1111-4111-8111-111111111111'
const classA = { id: 'class-a', name: 'C1' }
const classB = { id: 'class-b', name: 'C2' }
const SATURDAY = '2026-09-26'
const SUNDAY = '2026-09-27'

const slotA = {
  id: 'slot-a',
  classPeriodId: classA.id,
  weekday: 6,
  startTime: '09:00',
  endTime: '12:00',
  classPeriod: classA,
}
const slotB = { ...slotA, id: 'slot-b', classPeriodId: classB.id, classPeriod: classB }

function session(
  overrides: Partial<{
    id: string
    classPeriodId: string
    occurrenceKey: string
    occurredOn: Date
    status: 'DRAFT' | 'VALIDATED' | 'CANCELLED'
    validatedAt: Date | null
    classPeriod: { id: string; name: string }
  }>
) {
  return {
    id: 'session-1',
    classPeriodId: classA.id,
    occurrenceKey: slotA.id,
    occurredOn: new Date(`${SATURDAY}T00:00:00.000Z`),
    status: 'DRAFT' as const,
    validatedAt: null,
    classPeriod: classA,
    ...overrides,
  }
}

function setup({
  slots = [slotA, slotB] as unknown[],
  sessions = [] as unknown[],
  closures = [] as unknown[],
  flag = 'true',
  period = { id: periodId } as unknown,
} = {}) {
  const readGw = {
    findPeriod: vi.fn().mockResolvedValue(period),
    listAttendanceSlots: vi.fn().mockResolvedValue(slots),
    listAttendanceSessions: vi.fn().mockResolvedValue(sessions),
    listAttendanceClosures: vi.fn().mockResolvedValue(closures),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: flag }) }
  const run = (input: Record<string, unknown>) =>
    listAttendanceCallsFromMcp(
      scope,
      input as never,
      readGw as unknown as ReadGw,
      configGw as unknown as ConfigGw
    )
  return { readGw, configGw, run }
}

describe('listAttendanceCallsFromMcp', () => {
  it('reads the key school over inclusive UTC days', async () => {
    const { readGw, run } = setup()

    await run({
      periodId,
      classPeriodId: '22222222-2222-4222-8222-222222222222',
      from: SATURDAY,
      to: SUNDAY,
    })

    const filter = {
      periodId,
      classPeriodId: '22222222-2222-4222-8222-222222222222',
      from: new Date('2026-09-26T00:00:00.000Z'),
      before: new Date('2026-09-28T00:00:00.000Z'),
    }
    expect(readGw.findPeriod).toHaveBeenCalledWith('school-1', periodId)
    expect(readGw.listAttendanceSlots).toHaveBeenCalledWith('school-1', filter)
    expect(readGw.listAttendanceSessions).toHaveBeenCalledWith('school-1', filter)
    expect(readGw.listAttendanceClosures).toHaveBeenCalledWith(
      'school-1',
      filter.from,
      filter.before
    )
  })

  it('reports expected, open and validated calls for the matching weekday only', async () => {
    const validatedAt = new Date('2026-09-26T12:05:00.000Z')
    const { run } = setup({
      sessions: [
        session({ id: 'open-a' }),
        session({
          id: 'done-b',
          classPeriodId: classB.id,
          occurrenceKey: slotB.id,
          status: 'VALIDATED',
          validatedAt,
          classPeriod: classB,
        }),
      ],
    })

    const result = await run({ periodId, from: SATURDAY, to: SUNDAY })

    expect(result).toEqual({
      days: [
        {
          date: SATURDAY,
          closed: false,
          calls: [
            {
              classPeriod: classA,
              slotId: slotA.id,
              startTime: '09:00',
              endTime: '12:00',
              status: 'IN_PROGRESS',
              sessionId: 'open-a',
              validatedAt: null,
            },
            {
              classPeriod: classB,
              slotId: slotB.id,
              startTime: '09:00',
              endTime: '12:00',
              status: 'VALIDATED',
              sessionId: 'done-b',
              validatedAt,
            },
          ],
        },
      ],
    })
  })

  it('lists a not-started slot, an exceptional call and a cancelled one', async () => {
    const { run } = setup({
      sessions: [
        session({ id: 'cancelled-a', status: 'CANCELLED' }),
        session({
          id: 'adhoc-b',
          classPeriodId: classB.id,
          occurrenceKey: 'adhoc',
          classPeriod: classB,
        }),
      ],
    })

    const result = await run({ periodId, from: SATURDAY })

    expect(result).toMatchObject({
      days: [
        {
          calls: [
            { classPeriod: classB, slotId: slotB.id, status: 'NOT_STARTED', sessionId: null },
            {
              classPeriod: classA,
              slotId: slotA.id,
              status: 'CANCELLED',
              sessionId: 'cancelled-a',
            },
            { classPeriod: classB, slotId: null, status: 'IN_PROGRESS', sessionId: 'adhoc-b' },
          ],
        },
      ],
    })
  })

  it('keeps only already opened calls on a closure day', async () => {
    const { run } = setup({
      sessions: [session({ id: 'open-a' })],
      closures: [
        {
          status: 'PUBLISHED',
          category: 'CLOSURE',
          startAt: new Date('2026-09-26T00:00:00.000Z'),
          endAt: null,
        },
      ],
    })

    const result = await run({ periodId, from: SATURDAY })

    expect(result).toMatchObject({
      days: [{ date: SATURDAY, closed: true, calls: [{ slotId: slotA.id, sessionId: 'open-a' }] }],
    })
    expect((result as { days: Array<{ calls: unknown[] }> }).days[0].calls).toHaveLength(1)
  })

  it('omits days without any call', async () => {
    const { run } = setup()

    expect(await run({ periodId, from: '2026-09-28', to: '2026-09-29' })).toEqual({ days: [] })
  })

  it('refuses bad input, a reversed range and a range above 31 days before reading', async () => {
    const { readGw, configGw, run } = setup()

    expect(await run({ periodId: 'x', from: SATURDAY })).toBe('validationError')
    expect(await run({ periodId, from: SATURDAY, schoolId: 'other' })).not.toBe('validationError')
    expect(await run({ periodId, from: SUNDAY, to: SATURDAY })).toBe('invalidDateRange')
    expect(await run({ periodId, from: '2026-09-01', to: '2026-10-02' })).toBe('rangeTooLong')
    expect(await run({ periodId, from: '2026-09-01', to: '2026-10-01' })).not.toBe('rangeTooLong')
    expect(configGw.get).toHaveBeenCalledTimes(2)
    expect(readGw.listAttendanceSlots).toHaveBeenCalledTimes(2)
  })

  it('refuses with notConfigured when attendance is off', async () => {
    const { readGw, configGw, run } = setup({ flag: 'false' })

    expect(await run({ periodId, from: SATURDAY })).toBe('notConfigured')
    expect(configGw.get).toHaveBeenCalledWith('school-1', 'attendance_enabled')
    expect(readGw.findPeriod).not.toHaveBeenCalled()
  })

  it('refuses with notFound when the period is not in the key school', async () => {
    const { readGw, run } = setup({ period: null })

    expect(await run({ periodId, from: SATURDAY })).toBe('notFound')
    expect(readGw.listAttendanceSessions).not.toHaveBeenCalled()
  })
})
