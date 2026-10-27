import { describe, expect, it, vi } from 'vitest'
import { syncMealAbsencesFromAttendance } from './sync-meal-absences-from-attendance'

type AccountGw = Parameters<typeof syncMealAbsencesFromAttendance>[1]
type ConfigGw = Parameters<typeof syncMealAbsencesFromAttendance>[2]

const schoolId = 'school-a'
const tx = { tx: true }
const day = '2026-10-26'

// Lundi et jeudi, de septembre à la fin de l'année.
const segment = (accountId: string) => ({
  id: `s-${accountId}`,
  accountId,
  periodId: 'p',
  weekdays: [1, 4],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
})

function setup({
  sessionDay = day,
  entries = [] as Array<{ studentId: string; status: string }>,
  closures = [] as unknown[],
  enabled = true,
} = {}) {
  const accounts = [
    { id: 'acc-a-canteen', studentId: 'a', service: 'CANTEEN' },
    { id: 'acc-a-snack', studentId: 'a', service: 'SNACK' },
    { id: 'acc-b-canteen', studentId: 'b', service: 'CANTEEN' },
  ]
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findSessionDay: vi.fn().mockResolvedValue({ day: sessionDay, studentIds: ['a', 'b'] }),
    findClosures: vi.fn().mockResolvedValue(closures),
    lockAccounts: vi.fn().mockResolvedValue(accounts),
    listValidatedEntries: vi.fn().mockResolvedValue(entries),
    listSegments: vi.fn().mockResolvedValue(accounts.map((account) => segment(account.id))),
    addAttendanceAbsence: vi.fn().mockResolvedValue({ count: 1 }),
    removeAttendanceAbsence: vi.fn().mockResolvedValue({ count: 1 }),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: String(enabled) }) }
  const run = () =>
    syncMealAbsencesFromAttendance(
      { schoolId, sessionId: 'session-1', recordedById: 'user-1' },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { accountGw, run }
}

describe('syncMealAbsencesFromAttendance', () => {
  it('credits every service of a student absent from the day calls', async () => {
    const { accountGw, run } = setup({
      entries: [
        { studentId: 'a', status: 'ABSENT' },
        { studentId: 'b', status: 'PRESENT' },
      ],
    })

    expect(await run()).toBe('OK')
    expect(accountGw.listValidatedEntries).toHaveBeenCalledWith(tx, schoolId, day, ['a', 'b'])
    expect(accountGw.addAttendanceAbsence).toHaveBeenCalledTimes(2)
    expect(accountGw.addAttendanceAbsence).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'acc-a-canteen',
      day,
      recordedById: 'user-1',
    })
    expect(accountGw.addAttendanceAbsence).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'acc-a-snack',
      day,
      recordedById: 'user-1',
    })
    expect(accountGw.removeAttendanceAbsence).toHaveBeenCalledWith(
      tx,
      schoolId,
      'acc-b-canteen',
      day
    )
  })

  it('withdraws the attendance absence of a student corrected to present', async () => {
    const { accountGw, run } = setup({
      entries: [
        { studentId: 'a', status: 'ABSENT' },
        { studentId: 'a', status: 'LATE' },
      ],
    })

    expect(await run()).toBe('OK')
    expect(accountGw.addAttendanceAbsence).not.toHaveBeenCalled()
    expect(accountGw.removeAttendanceAbsence).toHaveBeenCalledTimes(3)
  })

  it('leaves a day outside the schedule untouched', async () => {
    const { accountGw, run } = setup({
      sessionDay: '2026-10-27',
      entries: [{ studentId: 'a', status: 'ABSENT' }],
    })

    expect(await run()).toBe('OK')
    expect(accountGw.addAttendanceAbsence).not.toHaveBeenCalled()
  })

  it('leaves a closed day untouched', async () => {
    const closure = {
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date(`${day}T00:00:00.000Z`),
      endAt: null,
    }
    const { accountGw, run } = setup({
      closures: [closure],
      entries: [{ studentId: 'a', status: 'ABSENT' }],
    })

    expect(await run()).toBe('OK')
    expect(accountGw.addAttendanceAbsence).not.toHaveBeenCalled()
  })

  it('does nothing when meals are disabled', async () => {
    const { accountGw, run } = setup({ enabled: false })

    expect(await run()).toBe('mealsDisabled')
    expect(accountGw.findSessionDay).not.toHaveBeenCalled()
  })
})
