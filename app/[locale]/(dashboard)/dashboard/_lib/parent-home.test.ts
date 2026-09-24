import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { student: { findMany: vi.fn() } }
const listByFamilyAndPeriodMock = vi.fn()
const getFamilyBalanceMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/gateways/class-schedule-gateway', () => ({
  classScheduleGateway: { listByFamilyAndPeriod: listByFamilyAndPeriodMock },
}))
vi.mock('@/use-cases/payments/family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getParentHome, nextWeeklyOccurrence } = await import('./parent-home')

// Mercredi 23 septembre 2026, 10 h UTC : jour de planning 3.
const WEDNESDAY = new Date('2026-09-23T10:00:00.000Z')

const student = (id: string, classPeriod: { id: string; name: string } | null) => ({
  id,
  person: { name: `Prénom ${id}`, lastname: 'Famille' },
  enrollments: classPeriod
    ? [{ classAssignments: [{ classPeriod: { ...classPeriod, level: { name: 'N1' } } }] }]
    : [],
})

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.student.findMany.mockResolvedValue([])
  listByFamilyAndPeriodMock.mockResolvedValue([])
  getFamilyBalanceMock.mockResolvedValue({ remainingBalance: 120 })
})

describe('getParentHome, family scope', () => {
  it('constrains the children query to the school and the linked family', async () => {
    await getParentHome('school-1', 'family-1', {
      periodId: 'period-1',
      paymentsEnabled: true,
      scheduleEnabled: true,
    })

    const { where } = dbMock.student.findMany.mock.calls[0][0]
    expect(where.schoolId).toBe('school-1')
    expect(where.person).toEqual({
      families: { some: { schoolId: 'school-1', familyId: 'family-1' } },
    })
  })

  it('reads the schedule and the balance of the linked family only', async () => {
    await getParentHome('school-1', 'family-1', {
      periodId: 'period-1',
      paymentsEnabled: true,
      scheduleEnabled: true,
    })

    expect(listByFamilyAndPeriodMock).toHaveBeenCalledWith('school-1', 'family-1', 'period-1')
    expect(getFamilyBalanceMock).toHaveBeenCalledWith('school-1', 'family-1')
  })

  it('skips the balance when payments are disabled and the schedule when it is off', async () => {
    const home = await getParentHome('school-1', 'family-1', {
      periodId: 'period-1',
      paymentsEnabled: false,
      scheduleEnabled: false,
    })

    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
    expect(listByFamilyAndPeriodMock).not.toHaveBeenCalled()
    expect(home.remainingBalance).toBeNull()
  })

  it('skips the schedule without a selected period', async () => {
    await getParentHome('school-1', 'family-1', {
      periodId: null,
      paymentsEnabled: true,
      scheduleEnabled: true,
    })

    expect(listByFamilyAndPeriodMock).not.toHaveBeenCalled()
  })

  it('maps each child to its class and next class', async () => {
    dbMock.student.findMany.mockResolvedValue([
      student('a', { id: 'class-a', name: 'CP A' }),
      student('b', null),
    ])
    listByFamilyAndPeriodMock.mockResolvedValue([
      { classPeriodId: 'class-a', weekday: 6, startTime: '09:00', endTime: '12:00' },
      { classPeriodId: 'class-other', weekday: 3, startTime: '14:00', endTime: '16:00' },
    ])

    const home = await getParentHome(
      'school-1',
      'family-1',
      { periodId: 'period-1', paymentsEnabled: true, scheduleEnabled: true },
      WEDNESDAY
    )

    expect(home.remainingBalance).toBe(120)
    expect(home.children).toEqual([
      {
        id: 'a',
        firstName: 'Prénom a',
        lastName: 'Famille',
        className: 'CP A',
        levelName: 'N1',
        nextClass: {
          date: new Date('2026-09-26T00:00:00.000Z'),
          daysAhead: 3,
          startTime: '09:00',
          endTime: '12:00',
        },
      },
      {
        id: 'b',
        firstName: 'Prénom b',
        lastName: 'Famille',
        className: null,
        levelName: null,
        nextClass: null,
      },
    ])
  })
})

describe('nextWeeklyOccurrence', () => {
  it('returns null without slots', () => {
    expect(nextWeeklyOccurrence([], WEDNESDAY)).toBeNull()
  })

  it('counts today as the nearest day and orders by start time', () => {
    const next = nextWeeklyOccurrence(
      [
        { weekday: 1, startTime: '08:00', endTime: '09:00' },
        { weekday: 3, startTime: '15:00', endTime: '16:00' },
        { weekday: 3, startTime: '09:00', endTime: '10:00' },
      ],
      WEDNESDAY
    )

    expect(next).toMatchObject({ daysAhead: 0, startTime: '09:00' })
  })

  it('wraps to the following week', () => {
    const next = nextWeeklyOccurrence(
      [{ weekday: 1, startTime: '08:00', endTime: '09:00' }],
      WEDNESDAY
    )

    expect(next).toMatchObject({ daysAhead: 5, date: new Date('2026-09-28T00:00:00.000Z') })
  })
})
