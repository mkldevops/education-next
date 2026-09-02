import { beforeEach, describe, expect, it, vi } from 'vitest'

type Tx = {
  classPeriod: {
    update: ReturnType<typeof vi.fn>
    findUniqueOrThrow: ReturnType<typeof vi.fn>
  }
  classPeriodTeacher: {
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
}

function withTransaction() {
  const tx: Tx = {
    classPeriod: {
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({}),
    },
    classPeriodTeacher: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }
  dbMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) => fn(tx))
  return tx
}

const dbMock = {
  classPeriod: {
    update: vi.fn(),
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
