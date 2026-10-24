import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn(async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })),
}))

const { stopMeal } = await import('./stop-meal')

type AccountGw = Parameters<typeof stopMeal>[1]
type ConfigGw = Parameters<typeof stopMeal>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const tx = { tx: true }
const NOW = new Date('2026-10-25T22:30:00.000Z')

function setup(segments: Array<{ id: string; startOn: string; endOn: string | null }>) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    lockAccount: vi.fn().mockResolvedValue('account-1'),
    listSegments: vi.fn().mockResolvedValue(segments),
    applyStop: vi.fn().mockResolvedValue(undefined),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  const run = (effectiveFrom = '2026-10-26') =>
    stopMeal(
      { schoolId, studentId, service: 'SNACK', effectiveFrom },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw,
      NOW
    )
  return { accountGw, run }
}

describe('stopMeal', () => {
  it('closes the running segment and drops the ones still to come', async () => {
    const { accountGw, run } = setup([
      { id: 'running', startOn: '2026-09-01', endOn: '2026-10-30' },
      { id: 'next', startOn: '2026-11-09', endOn: null },
    ])

    expect(await run()).toBe('OK')
    expect(accountGw.lockAccount).toHaveBeenCalledWith(tx, schoolId, studentId, 'SNACK', false)
    expect(accountGw.applyStop).toHaveBeenCalledWith(tx, schoolId, {
      removed: ['next'],
      closed: [{ id: 'running', endOn: '2026-10-25' }],
    })
  })

  it('refuses a backdated stop', async () => {
    expect(await setup([]).run('2026-10-25')).toBe('backdated')
  })

  it('refuses when nothing is served from that day', async () => {
    const { accountGw, run } = setup([{ id: 'old', startOn: '2026-09-01', endOn: '2026-10-02' }])

    expect(await run()).toBe('notSubscribed')
    expect(accountGw.applyStop).not.toHaveBeenCalled()
  })
})
