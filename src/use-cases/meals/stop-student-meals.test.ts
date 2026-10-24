import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn(async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })),
}))

const { stopStudentMeals } = await import('./stop-student-meals')

type AccountGw = Parameters<typeof stopStudentMeals>[1]

const schoolId = 'school-a'
const studentId = 'student-1'
const tx = { tx: true }
const NOW = new Date('2026-10-25T22:30:00.000Z')

function setup(accountIds: string[], periodIds: string[] = ['p']) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findEnrollmentPeriodIds: vi.fn().mockResolvedValue(periodIds),
    lockStudentAccounts: vi.fn().mockResolvedValue(accountIds),
    listSegments: vi.fn().mockResolvedValue([{ id: 's', startOn: '2026-09-01', endOn: null }]),
    applyStop: vi.fn().mockResolvedValue(undefined),
  }
  return { accountGw, gw: accountGw as unknown as AccountGw }
}

describe('stopStudentMeals', () => {
  it('stops every service of the student from today in the school time zone', async () => {
    const { accountGw, gw } = setup(['a', 'b'])

    await stopStudentMeals({ schoolId, studentId }, gw, NOW)

    expect(accountGw.listSegments).toHaveBeenCalledWith(tx, schoolId, ['a', 'b'], undefined)
    expect(accountGw.applyStop).toHaveBeenCalledWith(tx, schoolId, {
      removed: [],
      closed: [{ id: 's', endOn: '2026-10-25' }],
    })
  })

  it('limits a cancelled enrollment to the periods of its classes', async () => {
    const { accountGw, gw } = setup(['a'], ['p1'])

    await stopStudentMeals({ schoolId, studentId, enrollmentId: 'e' }, gw, NOW)

    expect(accountGw.findEnrollmentPeriodIds).toHaveBeenCalledWith(schoolId, 'e')
    expect(accountGw.listSegments).toHaveBeenCalledWith(tx, schoolId, ['a'], ['p1'])
  })

  it('does nothing for a student without meals', async () => {
    const { accountGw, gw } = setup([])

    await stopStudentMeals({ schoolId, studentId }, gw, NOW)

    expect(accountGw.applyStop).not.toHaveBeenCalled()
  })
})
