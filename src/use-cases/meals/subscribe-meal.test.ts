import { describe, expect, it, vi } from 'vitest'
import { subscribeMeal } from './subscribe-meal'

type AccountGw = Parameters<typeof subscribeMeal>[1]
type ConfigGw = Parameters<typeof subscribeMeal>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const periodId = '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b'
const tx = { tx: true }

function setup({
  flag = 'true',
  setting = { isEnabled: true, allowedWeekdays: [1, 2, 4, 5] },
  segments = [] as Array<{ id: string; startOn: string; endOn: string | null }>,
}: {
  flag?: string
  setting?: { isEnabled: boolean; allowedWeekdays: number[] } | null
  segments?: Array<{ id: string; startOn: string; endOn: string | null }>
} = {}) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findSetting: vi.fn().mockResolvedValue(setting),
    isActiveOwner: vi.fn().mockResolvedValue(true),
    findPeriod: vi.fn().mockResolvedValue({ start: '2026-09-01', end: '2027-07-03' }),
    lockAccount: vi.fn().mockResolvedValue('account-1'),
    listSegments: vi.fn().mockResolvedValue(segments),
    createSegment: vi.fn().mockResolvedValue({}),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: flag }) }
  const run = (input: Partial<Parameters<typeof subscribeMeal>[0]> = {}) =>
    subscribeMeal(
      {
        schoolId,
        studentId,
        service: 'CANTEEN',
        periodId,
        weekdays: [4, 1],
        startOn: '2026-09-07',
        ...input,
      },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { accountGw, run }
}

describe('subscribeMeal', () => {
  it('opens an account and a segment running to the end of the period', async () => {
    const { accountGw, run } = setup()

    expect(await run()).toBe('OK')
    expect(accountGw.lockAccount).toHaveBeenCalledWith(tx, schoolId, { studentId }, 'CANTEEN', true)
    expect(accountGw.createSegment).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'account-1',
      periodId,
      weekdays: [1, 4],
      startOn: '2026-09-07',
      endOn: null,
    })
  })

  it('refuses days the school does not serve', async () => {
    const { accountGw, run } = setup()

    expect(await run({ weekdays: [1, 3] })).toBe('invalidWeekdays')
    expect(accountGw.createSegment).not.toHaveBeenCalled()
  })

  it('refuses a disabled service and a school that has not opted in', async () => {
    expect(await setup({ setting: { isEnabled: false, allowedWeekdays: [1] } }).run()).toBe(
      'serviceDisabled'
    )
    expect(await setup({ setting: null }).run()).toBe('serviceDisabled')
    expect(await setup({ flag: 'false' }).run()).toBe('mealsDisabled')
  })

  it('refuses a start outside the period', async () => {
    const { run } = setup()

    expect(await run({ startOn: '2027-07-04' })).toBe('outsidePeriod')
  })

  it('refuses a second segment overlapping one already open', async () => {
    const { accountGw, run } = setup({
      segments: [{ id: 's', startOn: '2026-09-01', endOn: null }],
    })

    expect(await run()).toBe('alreadySubscribed')
    expect(accountGw.createSegment).not.toHaveBeenCalled()
  })

  it('subscribes again after an earlier stop', async () => {
    const { run } = setup({ segments: [{ id: 's', startOn: '2026-09-01', endOn: '2026-09-04' }] })

    expect(await run()).toBe('OK')
  })

  it('refuses an archived student', async () => {
    const { accountGw, run } = setup()
    accountGw.isActiveOwner.mockResolvedValue(false)

    expect(await run()).toBe('notFound')
    expect(accountGw.transaction).not.toHaveBeenCalled()
  })
})
