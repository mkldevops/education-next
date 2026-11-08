import { describe, expect, it, vi } from 'vitest'
import { toggleMealAbsence } from './toggle-meal-absence'

type AccountGw = Parameters<typeof toggleMealAbsence>[1]
type ConfigGw = Parameters<typeof toggleMealAbsence>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const tx = { tx: true }

// Lundi et jeudi, de septembre à la fin de l'année.
const segment = {
  id: 's',
  accountId: 'account-1',
  periodId: 'p',
  weekdays: [1, 4],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
}

function setup({
  accountId = 'account-1' as string | null,
  closures = [] as unknown[],
  enabled = true,
} = {}) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    lockAccount: vi.fn().mockResolvedValue(accountId),
    listSegments: vi.fn().mockResolvedValue([segment]),
    findClosures: vi.fn().mockResolvedValue(closures),
    addAbsence: vi.fn().mockResolvedValue({ count: 1 }),
    removeAbsence: vi.fn().mockResolvedValue({ count: 1 }),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: String(enabled) }) }
  const run = (day: string, absent = true) =>
    toggleMealAbsence(
      { schoolId, studentId, service: 'CANTEEN', day, absent, recordedById: 'user-1' },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { accountGw, run }
}

describe('toggleMealAbsence', () => {
  it('records an absence on a served day', async () => {
    const { accountGw, run } = setup()

    expect(await run('2026-10-26')).toBe('OK')
    expect(accountGw.lockAccount).toHaveBeenCalledWith(
      tx,
      schoolId,
      { studentId },
      'CANTEEN',
      false
    )
    expect(accountGw.addAbsence).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'account-1',
      day: '2026-10-26',
      recordedById: 'user-1',
    })
  })

  it('removes an absence', async () => {
    const { accountGw, run } = setup()

    expect(await run('2026-10-26', false)).toBe('OK')
    expect(accountGw.removeAbsence).toHaveBeenCalledWith(tx, schoolId, 'account-1', '2026-10-26')
    expect(accountGw.addAbsence).not.toHaveBeenCalled()
  })

  it('refuses a day outside the schedule', async () => {
    const { accountGw, run } = setup()

    expect(await run('2026-10-27')).toBe('notServed')
    expect(accountGw.addAbsence).not.toHaveBeenCalled()
  })

  it('refuses a closed day', async () => {
    const closure = {
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date('2026-10-26T00:00:00.000Z'),
      endAt: null,
    }

    expect(await setup({ closures: [closure] }).run('2026-10-26')).toBe('notServed')
  })

  it('refuses without an account', async () => {
    expect(await setup({ accountId: null }).run('2026-10-26')).toBe('notSubscribed')
  })

  it('refuses when meals are disabled', async () => {
    expect(await setup({ enabled: false }).run('2026-10-26')).toBe('mealsDisabled')
  })
})
