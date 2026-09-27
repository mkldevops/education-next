import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  classAssignment: { findMany: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { classScheduleGateway } = await import('../class-schedule-gateway')

const SCHOOL = 'school-1'
const FAMILY = 'family-1'
const PERIOD = 'period-1'

beforeEach(() => vi.clearAllMocks())

describe('classScheduleGateway.listByFamilyAndPeriod', () => {
  it('bounds active assignments by school, family and period before reading slots', async () => {
    dbMock.classAssignment.findMany.mockResolvedValue([
      {
        classPeriodId: 'class-1',
        enrollment: { student: { person: { name: 'Lina', lastname: 'Martin' } } },
      },
      {
        classPeriodId: 'class-2',
        enrollment: { student: { person: { name: 'Noé', lastname: 'Martin' } } },
      },
    ])
    dbMock.classScheduleSlot.findMany.mockResolvedValue([
      { id: 'slot-1', classPeriodId: 'class-1' },
      { id: 'slot-2', classPeriodId: 'class-2' },
    ])

    const result = await classScheduleGateway.listByFamilyAndPeriod(SCHOOL, FAMILY, PERIOD)

    expect(dbMock.classAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: SCHOOL,
          endAt: null,
          classPeriod: { periodId: PERIOD, isActive: true },
          enrollment: {
            student: {
              isActive: true,
              person: { families: { some: { schoolId: SCHOOL, familyId: FAMILY } } },
            },
          },
        }),
      })
    )
    expect(dbMock.classScheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: SCHOOL,
          classPeriodId: { in: ['class-1', 'class-2'] },
          classPeriod: { periodId: PERIOD, isActive: true },
        }),
      })
    )
    expect(result).toEqual([
      expect.objectContaining({ students: ['Lina Martin'] }),
      expect.objectContaining({ students: ['Noé Martin'] }),
    ])
  })

  it('returns an explicit empty data set without reading all school slots when no child is assigned', async () => {
    dbMock.classAssignment.findMany.mockResolvedValue([])

    await expect(
      classScheduleGateway.listByFamilyAndPeriod(SCHOOL, FAMILY, PERIOD)
    ).resolves.toEqual([])
    expect(dbMock.classScheduleSlot.findMany).not.toHaveBeenCalled()
  })

  it('deduplicates children who share a class', async () => {
    dbMock.classAssignment.findMany.mockResolvedValue([
      {
        classPeriodId: 'class-1',
        enrollment: { student: { person: { name: 'Lina', lastname: 'Martin' } } },
      },
      {
        classPeriodId: 'class-1',
        enrollment: { student: { person: { name: 'Lina', lastname: 'Martin' } } },
      },
    ])
    dbMock.classScheduleSlot.findMany.mockResolvedValue([
      { id: 'slot-1', classPeriodId: 'class-1' },
    ])

    await expect(
      classScheduleGateway.listByFamilyAndPeriod(SCHOOL, FAMILY, PERIOD)
    ).resolves.toEqual([expect.objectContaining({ students: ['Lina Martin'] })])
  })
})

describe('classScheduleGateway.listByTeachers', () => {
  it('reads nothing for an empty teacher list', async () => {
    await expect(classScheduleGateway.listByTeachers(SCHOOL, [])).resolves.toEqual([])
    expect(dbMock.classScheduleSlot.findMany).not.toHaveBeenCalled()
  })

  it('bounds the school-wide read by school and teachers with a minimal projection', async () => {
    dbMock.classScheduleSlot.findMany.mockResolvedValue([])

    await classScheduleGateway.listByTeachers(SCHOOL, ['teacher-1'])

    expect(dbMock.classScheduleSlot.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, teachers: { some: { teacherId: { in: ['teacher-1'] } } } },
      select: {
        id: true,
        classPeriodId: true,
        weekday: true,
        startTime: true,
        endTime: true,
        teachers: { select: { teacherId: true } },
      },
    })
  })
})

describe('classScheduleGateway.createManyWithOverlapValidation', () => {
  const tx = {
    $executeRaw: vi.fn(),
    classScheduleSlot: { findMany: vi.fn(), create: vi.fn() },
  }
  const slots = [
    {
      classPeriodId: 'class-b',
      weekday: 6,
      startTime: '09:00',
      endTime: '12:00',
      description: null,
      teacherIds: ['teacher-2'],
    },
    {
      classPeriodId: 'class-a',
      weekday: 6,
      startTime: '09:00',
      endTime: '12:00',
      description: null,
      teacherIds: ['teacher-1', 'teacher-2'],
    },
  ]
  const lockKeys = () =>
    tx.$executeRaw.mock.calls.map((call: unknown[]) => (call[1] as string | undefined) ?? call[0])

  beforeEach(() => {
    tx.classScheduleSlot.findMany.mockReset().mockResolvedValue([])
    tx.classScheduleSlot.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'slot-1' })
      .mockResolvedValueOnce({ id: 'slot-2' })
  })

  it('takes every lock of the batch, sorted and deduplicated, before the first write', async () => {
    const result = await classScheduleGateway.createManyWithOverlapValidation(
      tx as never,
      SCHOOL,
      slots,
      true
    )

    expect(lockKeys()).toEqual([
      'class:school-1:class-a:6',
      'class:school-1:class-b:6',
      'teacher:school-1:teacher-1:6',
      'teacher:school-1:teacher-2:6',
    ])
    expect(tx.$executeRaw.mock.invocationCallOrder[3]).toBeLessThan(
      tx.classScheduleSlot.create.mock.invocationCallOrder[0]
    )
    expect(result).toEqual({
      status: 'OK',
      slots: [
        { id: 'slot-1', teacherOverlapIds: [] },
        { id: 'slot-2', teacherOverlapIds: [] },
      ],
    })
  })

  it('stops at the first conflicting slot and names its index', async () => {
    tx.classScheduleSlot.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'slot-existing' }])

    const result = await classScheduleGateway.createManyWithOverlapValidation(
      tx as never,
      SCHOOL,
      slots,
      true
    )

    expect(result).toEqual({ status: 'classOverlap', index: 1 })
    expect(tx.classScheduleSlot.create).toHaveBeenCalledTimes(1)
  })

  it('refuses a teacher overlap when the school forbids it, and reports it otherwise', async () => {
    tx.classScheduleSlot.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'slot-busy' }])

    expect(
      await classScheduleGateway.createManyWithOverlapValidation(tx as never, SCHOOL, slots, false)
    ).toEqual({ status: 'teacherOverlap', index: 0 })
    expect(tx.classScheduleSlot.create).not.toHaveBeenCalled()

    tx.classScheduleSlot.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'slot-busy' }])
    const result = await classScheduleGateway.createManyWithOverlapValidation(
      tx as never,
      SCHOOL,
      slots.slice(0, 1),
      true
    )
    expect(result).toEqual({
      status: 'OK',
      slots: [{ id: 'slot-1', teacherOverlapIds: ['slot-busy'] }],
    })
  })
})
