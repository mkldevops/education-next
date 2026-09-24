import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  classScheduleSlot: { findMany: vi.fn() },
  attendanceSession: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getTodayAgenda } = await import('./today-agenda')

// Mercredi 23 septembre 2026 : jour de planning 3.
const WEDNESDAY = new Date('2026-09-23T10:00:00.000Z')
const DAY = new Date('2026-09-23T00:00:00.000Z')

const slot = (id: string, classPeriodId: string, startTime: string) => ({
  id,
  classPeriodId,
  weekday: 3,
  startTime,
  endTime: '12:00',
  classPeriod: { name: `Classe ${classPeriodId}` },
  teachers: [{ teacher: { firstName: 'Awa', lastName: 'Diallo' } }],
})

const enabled = { periodId: 'period-1', attendanceEnabled: true, scheduleEnabled: true }

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.classScheduleSlot.findMany.mockResolvedValue([])
  dbMock.attendanceSession.findMany.mockResolvedValue([])
  dbMock.event.findMany.mockResolvedValue([])
})

describe('getTodayAgenda', () => {
  it('reads nothing without a period or without planning and attendance', async () => {
    expect(await getTodayAgenda('school-1', { ...enabled, periodId: null }, WEDNESDAY)).toBeNull()
    expect(
      await getTodayAgenda(
        'school-1',
        { periodId: 'period-1', attendanceEnabled: false, scheduleEnabled: false },
        WEDNESDAY
      )
    ).toBeNull()
    expect(dbMock.classScheduleSlot.findMany).not.toHaveBeenCalled()
  })

  it('scopes every read to the school, the period and the UTC day', async () => {
    await getTodayAgenda('school-1', enabled, WEDNESDAY)

    const slots = dbMock.classScheduleSlot.findMany.mock.calls[0][0].where
    expect(slots).toEqual({
      schoolId: 'school-1',
      weekday: 3,
      classPeriod: { periodId: 'period-1', isActive: true },
    })
    const sessions = dbMock.attendanceSession.findMany.mock.calls[0][0].where
    expect(sessions).toEqual({
      schoolId: 'school-1',
      occurredOn: DAY,
      classPeriod: { periodId: 'period-1', isActive: true },
    })
    expect(dbMock.event.findMany.mock.calls[0][0].where.schoolId).toBe('school-1')
  })

  it('counts the calls left to validate and drops cancelled sessions', async () => {
    dbMock.classScheduleSlot.findMany.mockResolvedValue([
      slot('s1', 'c1', '09:00'),
      slot('s2', 'c2', '10:00'),
      slot('s3', 'c3', '11:00'),
    ])
    dbMock.attendanceSession.findMany.mockResolvedValue([
      { classPeriodId: 'c2', occurrenceKey: 's2', status: 'VALIDATED' },
      { classPeriodId: 'c3', occurrenceKey: 's3', status: 'CANCELLED' },
    ])

    const agenda = await getTodayAgenda('school-1', enabled, WEDNESDAY)

    expect(agenda?.closed).toBe(false)
    expect(agenda?.attendanceToTake).toBe(1)
    expect(agenda?.classes.map((item) => [item.slotId, item.attendance])).toEqual([
      ['s1', 'NOT_STARTED'],
      ['s2', 'VALIDATED'],
    ])
    expect(agenda?.classes[0].teachers).toEqual(['Awa Diallo'])
  })

  it('lists classes without attendance status when attendance is disabled', async () => {
    dbMock.classScheduleSlot.findMany.mockResolvedValue([slot('s1', 'c1', '09:00')])

    const agenda = await getTodayAgenda(
      'school-1',
      { ...enabled, attendanceEnabled: false },
      WEDNESDAY
    )

    expect(dbMock.attendanceSession.findMany).not.toHaveBeenCalled()
    expect(agenda?.attendanceToTake).toBe(0)
    expect(agenda?.classes[0].attendance).toBeNull()
  })

  it('keeps only opened sessions on a closure day', async () => {
    dbMock.classScheduleSlot.findMany.mockResolvedValue([
      slot('s1', 'c1', '09:00'),
      slot('s2', 'c2', '10:00'),
    ])
    dbMock.attendanceSession.findMany.mockResolvedValue([
      { classPeriodId: 'c2', occurrenceKey: 's2', status: 'DRAFT' },
    ])
    dbMock.event.findMany.mockResolvedValue([
      { status: 'PUBLISHED', category: 'CLOSURE', startAt: DAY, endAt: null },
    ])

    const agenda = await getTodayAgenda('school-1', enabled, WEDNESDAY)

    expect(agenda?.closed).toBe(true)
    expect(agenda?.classes.map((item) => item.slotId)).toEqual(['s2'])
  })
})
