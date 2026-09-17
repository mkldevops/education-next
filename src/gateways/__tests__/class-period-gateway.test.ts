import { beforeEach, describe, expect, it, vi } from 'vitest'

type Tx = {
  classPeriod: {
    update: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    findUniqueOrThrow: ReturnType<typeof vi.fn>
  }
  classPeriodTeacher: {
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
  classScheduleSlotTeacher: {
    deleteMany: ReturnType<typeof vi.fn>
  }
}

function withTransaction() {
  const tx: Tx = {
    classPeriod: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        _count: {
          classAssignments: 0,
          teachers: 0,
          scheduleSlots: 0,
          attendanceSessions: 0,
        },
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({}),
    },
    classPeriodTeacher: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    classScheduleSlotTeacher: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }
  dbMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) => fn(tx))
  return tx
}

const dbMock = {
  classPeriod: {
    update: vi.fn(),
  },
  classPeriodTeacher: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `config-gateway.test.ts` et `school-gateway.test.ts`.
const { classPeriodGateway } = await import('../class-period-gateway')

const SCHOOL = 'school-1'
const CLASS_ID = 'class-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('classPeriodGateway.update', () => {
  it('spares deactivated teachers from the assignment sweep', async () => {
    const tx = withTransaction()

    await classPeriodGateway.update(SCHOOL, CLASS_ID, { teacherIds: ['teacher-1'] })

    expect(tx.classPeriodTeacher.deleteMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, classPeriodId: CLASS_ID, teacher: { isActive: true } },
    })
    expect(tx.classScheduleSlotTeacher.deleteMany).toHaveBeenCalledWith({
      where: {
        schoolId: SCHOOL,
        classScheduleSlot: { classPeriodId: CLASS_ID },
        teacherId: { notIn: ['teacher-1'] },
      },
    })
  })

  it('still replaces the active-teacher roster with the submitted ids', async () => {
    const tx = withTransaction()

    await classPeriodGateway.update(SCHOOL, CLASS_ID, { teacherIds: ['teacher-1', 'teacher-2'] })

    expect(tx.classPeriodTeacher.createMany).toHaveBeenCalledWith({
      data: [
        { schoolId: SCHOOL, classPeriodId: CLASS_ID, teacherId: 'teacher-1' },
        { schoolId: SCHOOL, classPeriodId: CLASS_ID, teacherId: 'teacher-2' },
      ],
    })
  })

  it('never touches classPeriodTeacher when teacherIds is omitted', async () => {
    await classPeriodGateway.update(SCHOOL, CLASS_ID, { capacity: 25 })

    expect(dbMock.classPeriod.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: CLASS_ID, schoolId: SCHOOL } },
      data: { capacity: 25 },
    })
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('classPeriodGateway.listInactiveTeacherAssignments', () => {
  it('reads only assignments whose teacher is inactive', async () => {
    dbMock.classPeriodTeacher.findMany.mockResolvedValue([])

    await classPeriodGateway.listInactiveTeacherAssignments(SCHOOL, CLASS_ID)

    expect(dbMock.classPeriodTeacher.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, classPeriodId: CLASS_ID, teacher: { isActive: false } },
      include: { teacher: true },
      orderBy: { teacher: { lastName: 'asc' } },
    })
  })
})

describe('classPeriodGateway.deactivate', () => {
  it('archives an unused class within its school scope', async () => {
    const tx = withTransaction()

    expect(await classPeriodGateway.deactivate(SCHOOL, CLASS_ID)).toBe('OK')
    expect(tx.classPeriod.findUnique).toHaveBeenCalledWith({
      where: { id_schoolId: { id: CLASS_ID, schoolId: SCHOOL } },
      select: {
        _count: {
          select: {
            classAssignments: true,
            teachers: true,
            scheduleSlots: true,
            attendanceSessions: true,
          },
        },
      },
    })
    expect(tx.classPeriod.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: CLASS_ID, schoolId: SCHOOL } },
      data: { isActive: false },
    })
  })

  it('refuses a class with any dependent record', async () => {
    const tx = withTransaction()
    tx.classPeriod.findUnique.mockResolvedValue({
      _count: {
        classAssignments: 1,
        teachers: 0,
        scheduleSlots: 0,
        attendanceSessions: 0,
      },
    })

    expect(await classPeriodGateway.deactivate(SCHOOL, CLASS_ID)).toBe('classInUse')
    expect(tx.classPeriod.update).not.toHaveBeenCalled()
  })

  it('reports a class outside the active school scope as missing', async () => {
    const tx = withTransaction()
    tx.classPeriod.findUnique.mockResolvedValue(null)

    expect(await classPeriodGateway.deactivate(SCHOOL, CLASS_ID)).toBe('notFound')
    expect(tx.classPeriod.update).not.toHaveBeenCalled()
  })
})

describe('classPeriodGateway.unassignTeacher', () => {
  it('deletes exactly the targeted inactive-teacher assignment, scoped by school', async () => {
    const tx = withTransaction()
    tx.classPeriodTeacher.deleteMany.mockResolvedValue({ count: 1 })

    const removed = await classPeriodGateway.unassignTeacher(SCHOOL, CLASS_ID, 'teacher-1')

    expect(tx.classPeriodTeacher.deleteMany).toHaveBeenCalledWith({
      where: {
        schoolId: SCHOOL,
        classPeriodId: CLASS_ID,
        teacherId: 'teacher-1',
        teacher: { isActive: false },
      },
    })
    expect(tx.classScheduleSlotTeacher.deleteMany).toHaveBeenCalledWith({
      where: {
        schoolId: SCHOOL,
        teacherId: 'teacher-1',
        classScheduleSlot: { classPeriodId: CLASS_ID },
      },
    })
    expect(removed).toBe(true)
  })

  it('reports false when no assignment matched', async () => {
    const tx = withTransaction()
    tx.classPeriodTeacher.deleteMany.mockResolvedValue({ count: 0 })

    const removed = await classPeriodGateway.unassignTeacher(SCHOOL, CLASS_ID, 'teacher-1')

    expect(removed).toBe(false)
    expect(tx.classScheduleSlotTeacher.deleteMany).not.toHaveBeenCalled()
  })
})
