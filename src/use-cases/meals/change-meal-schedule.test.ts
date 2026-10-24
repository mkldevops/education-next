import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn(async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })),
}))

const { changeMealSchedule } = await import('./change-meal-schedule')

type AccountGw = Parameters<typeof changeMealSchedule>[1]
type ConfigGw = Parameters<typeof changeMealSchedule>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const tx = { tx: true }
// 22 h 30 UTC le 25 octobre : déjà le 26 à Moroni.
const NOW = new Date('2026-10-25T22:30:00.000Z')

type Segment = { id: string; periodId: string; startOn: string; endOn: string | null }

function setup(segments: Segment[], accountId: string | null = 'account-1') {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findSetting: vi.fn().mockResolvedValue({ isEnabled: true, allowedWeekdays: [1, 2, 4, 5] }),
    lockAccount: vi.fn().mockResolvedValue(accountId),
    listSegments: vi.fn().mockResolvedValue(segments),
    applyStop: vi.fn().mockResolvedValue(undefined),
    createSegment: vi.fn().mockResolvedValue({}),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  const run = (effectiveFrom = '2026-10-26') =>
    changeMealSchedule(
      { schoolId, studentId, service: 'CANTEEN', weekdays: [2, 5], effectiveFrom },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw,
      NOW
    )
  return { accountGw, run }
}

describe('changeMealSchedule', () => {
  it('closes the running segment the day before and continues it with the new days', async () => {
    const { accountGw, run } = setup([
      { id: 's', periodId: 'p', startOn: '2026-09-01', endOn: '2026-12-18' },
    ])

    expect(await run()).toBe('OK')
    expect(accountGw.applyStop).toHaveBeenCalledWith(tx, schoolId, {
      removed: [],
      closed: [{ id: 's', endOn: '2026-10-25' }],
    })
    expect(accountGw.createSegment).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'account-1',
      periodId: 'p',
      weekdays: [2, 5],
      startOn: '2026-10-26',
      endOn: '2026-12-18',
    })
  })

  it('replaces a segment that has not started yet from its own start', async () => {
    const { accountGw, run } = setup([
      { id: 'next', periodId: 'p', startOn: '2026-11-09', endOn: null },
    ])

    expect(await run()).toBe('OK')
    expect(accountGw.applyStop).toHaveBeenCalledWith(tx, schoolId, {
      removed: ['next'],
      closed: [],
    })
    expect(accountGw.createSegment).toHaveBeenCalledWith(
      tx,
      schoolId,
      expect.objectContaining({ startOn: '2026-11-09', endOn: null })
    )
  })

  it('refuses a change dated before today in the school time zone', async () => {
    const { accountGw, run } = setup([])

    expect(await run('2026-10-25')).toBe('backdated')
    expect(accountGw.transaction).not.toHaveBeenCalled()
  })

  it('refuses a child with no segment left', async () => {
    expect(await setup([], null).run()).toBe('notSubscribed')
    expect(
      await setup([{ id: 'old', periodId: 'p', startOn: '2026-09-01', endOn: '2026-10-02' }]).run()
    ).toBe('notSubscribed')
  })
})
