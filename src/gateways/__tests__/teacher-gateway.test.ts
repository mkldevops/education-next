import { beforeEach, describe, expect, it, vi } from 'vitest'

const runTransactionMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/serializable-transaction', () => ({
  inSerializableTransaction: runTransactionMock,
}))

const { teacherGateway } = await import('../teacher-gateway')

type TeacherAccessTx = ReturnType<typeof createTx>

function createTx(role: 'ADMIN' | 'PARENT' | 'TEACHER' | null) {
  return {
    teacher: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      update: vi.fn(),
    },
    schoolMember: {
      findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
      delete: vi.fn(),
    },
    userFamily: { deleteMany: vi.fn() },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('teacherGateway.revokeUserAccess', () => {
  it.each(['ADMIN', 'PARENT'] as const)(
    'unlinks a %s teacher profile without removing its principal membership',
    async (role) => {
      const tx = createTx(role)
      runTransactionMock.mockImplementation((callback: (tx: TeacherAccessTx) => unknown) =>
        callback(tx)
      )

      await expect(teacherGateway.revokeUserAccess('school-1', 'teacher-1')).resolves.toBe('OK')

      expect(tx.teacher.update).toHaveBeenCalledWith({
        where: { id_schoolId: { id: 'teacher-1', schoolId: 'school-1' } },
        data: { userId: null },
      })
      expect(tx.schoolMember.delete).not.toHaveBeenCalled()
    }
  )

  it('removes the teacher-only membership and its family links', async () => {
    const tx = createTx('TEACHER')
    runTransactionMock.mockImplementation((callback: (tx: TeacherAccessTx) => unknown) =>
      callback(tx)
    )

    await expect(teacherGateway.revokeUserAccess('school-1', 'teacher-1')).resolves.toBe('OK')

    expect(tx.userFamily.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', schoolId: 'school-1' },
    })
    expect(tx.schoolMember.delete).toHaveBeenCalledWith({
      where: { userId_schoolId: { userId: 'user-1', schoolId: 'school-1' } },
    })
  })

  it('does not mutate a teacher absent from the requested school', async () => {
    const tx = createTx(null)
    tx.teacher.findUnique.mockResolvedValue(null)
    runTransactionMock.mockImplementation((callback: (tx: TeacherAccessTx) => unknown) =>
      callback(tx)
    )

    await expect(teacherGateway.revokeUserAccess('school-1', 'teacher-foreign')).resolves.toBe(
      'notFound'
    )
    expect(tx.teacher.update).not.toHaveBeenCalled()
    expect(tx.schoolMember.findUnique).not.toHaveBeenCalled()
  })
})
