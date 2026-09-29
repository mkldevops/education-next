import { beforeEach, describe, expect, it, vi } from 'vitest'

const isTeacherExpensesEnabled = vi.fn()
const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()

const tx = {
  teacher: { findFirst: vi.fn() },
  teacherExpense: { create: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

vi.mock('@/use-cases/config/is-teacher-expenses-enabled', () => ({ isTeacherExpensesEnabled }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

const { commitRecordTeacherExpense } = await import('./commit-record-teacher-expense')

const scope = {
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: false,
}

const resolved = {
  tool: 'record_teacher_expense',
  teacher: { id: 'teacher-1', firstName: 'Fatima', lastName: 'Ali' },
  amount: 12.5,
  category: 'Goûter',
  description: 'Gâteaux du samedi',
  requestedAt: '2026-09-12T00:00:00.000Z',
  paidAt: null,
}

const input = { draftId: '33333333-3333-4333-8333-333333333333', checksum: 'abcdef012345' }

const written = {
  id: 'expense-1',
  teacherId: 'teacher-1',
  amount: 12.5,
  requestedAt: '2026-09-12T00:00:00.000Z',
  paidAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  isTeacherExpensesEnabled.mockResolvedValue(true)
  claim.mockResolvedValue({ count: 1 })
  findById.mockResolvedValue({
    ownerKind: 'MCP_KEY',
    keyId: 'key-1',
    userId: null,
    tool: 'record_teacher_expense',
    checksum: input.checksum,
    resolved,
  })
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  tx.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
  tx.teacherExpense.create.mockResolvedValue({ id: 'expense-1' })
  tx.mcpDraft.updateMany.mockResolvedValue({ count: 1 })
})

describe('commitRecordTeacherExpense', () => {
  it('writes the validated note in the scoped school and records the result with it', async () => {
    const result = await commitRecordTeacherExpense(scope, input)

    expect(result).toEqual(written)
    expect(tx.teacher.findFirst).toHaveBeenCalledWith({
      where: { id: 'teacher-1', schoolId: 'school-1', isActive: true },
      select: { id: true },
    })
    expect(tx.teacherExpense.create).toHaveBeenCalledWith({
      data: {
        schoolId: 'school-1',
        teacherId: 'teacher-1',
        amount: 12.5,
        category: 'Goûter',
        description: 'Gâteaux du samedi',
        requestedAt: new Date('2026-09-12T00:00:00.000Z'),
        paidAt: null,
      },
      select: { id: true },
    })
    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: input.draftId, schoolId: 'school-1' },
      data: { result: written },
    })
  })

  it('refuses a teacher archived since the preview, writes nothing and gives the lock back', async () => {
    tx.teacher.findFirst.mockResolvedValue(null)

    const result = await commitRecordTeacherExpense(scope, input)

    expect(result).toBe('notFound')
    expect(tx.teacherExpense.create).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('returns the recorded note on a replay instead of writing a second one', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'record_teacher_expense',
      checksum: input.checksum,
      status: 'COMMITTED',
      result: written,
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordTeacherExpense(scope, input)).toEqual(written)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses without claiming the draft once expense notes are turned off', async () => {
    isTeacherExpensesEnabled.mockResolvedValue(false)

    expect(await commitRecordTeacherExpense(scope, input)).toBe('notConfigured')
    expect(claim).not.toHaveBeenCalled()
  })

  it('does not commit a draft of another tool', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordTeacherExpense(scope, input)).toBe('draftNotFound')
    expect(transaction).not.toHaveBeenCalled()
  })
})
