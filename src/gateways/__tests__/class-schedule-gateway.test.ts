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
