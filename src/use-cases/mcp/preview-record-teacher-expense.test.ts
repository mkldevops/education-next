import { beforeEach, describe, expect, it, vi } from 'vitest'

const isTeacherExpensesEnabled = vi.fn()
const listTeachers = vi.fn()
const findTeacher = vi.fn()
const findSimilarExpenses = vi.fn()
const createDraft = vi.fn()

vi.mock('@/use-cases/config/is-teacher-expenses-enabled', () => ({ isTeacherExpensesEnabled }))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway: { listTeachers, findTeacher } }))
vi.mock('@/gateways/teacher-gateway', () => ({
  teacherGateway: { findSimilarExpenses },
}))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewRecordTeacherExpense } = await import('./preview-record-teacher-expense')

const scope = {
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}

const fatima = { id: '11111111-1111-4111-8111-111111111111', firstName: 'Fatima', lastName: 'Ali' }
const amina = { id: '22222222-2222-4222-8222-222222222222', firstName: 'Amina', lastName: 'Ali' }

const input = {
  teacherName: 'Fatima',
  amount: 12.5,
  category: 'Goûter',
  description: 'Gâteaux du samedi',
  requestedAt: '2026-09-12',
}

const now = () => new Date('2026-09-29T21:30:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  isTeacherExpensesEnabled.mockResolvedValue(true)
  listTeachers.mockResolvedValue([amina, fatima])
  findTeacher.mockResolvedValue(fatima)
  findSimilarExpenses.mockResolvedValue([])
  createDraft.mockResolvedValue({ id: 'draft-1' })
})

describe('previewRecordTeacherExpense', () => {
  it('resolves the teacher by name and stores a plan of calendar days in the scoped school', async () => {
    const result = await previewRecordTeacherExpense(scope, input, now)

    expect(listTeachers).toHaveBeenCalledWith('school-1')
    expect(findSimilarExpenses).toHaveBeenCalledWith('school-1', {
      teacherId: fatima.id,
      amount: 12.5,
      requestedFrom: new Date('2026-09-12T00:00:00.000Z'),
      requestedBefore: new Date('2026-09-13T00:00:00.000Z'),
    })
    expect(result).toMatchObject({
      draftId: 'draft-1',
      plan: {
        tool: 'record_teacher_expense',
        teacher: fatima,
        amount: 12.5,
        category: 'Goûter',
        description: 'Gâteaux du samedi',
        requestedAt: '2026-09-12T00:00:00.000Z',
        paidAt: null,
      },
      warnings: [],
      blockers: [],
    })
    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ tool: 'record_teacher_expense' })
    )
  })

  it('defaults the request to today, in UTC, like the dashboard form', async () => {
    const { requestedAt: _, ...withoutDate } = input

    const result = await previewRecordTeacherExpense(scope, withoutDate, now)

    expect(result).toMatchObject({ plan: { requestedAt: '2026-09-29T00:00:00.000Z' } })
  })

  it('resolves a teacher named by id within the scoped school', async () => {
    const { teacherName: _, ...rest } = input

    const result = await previewRecordTeacherExpense(scope, { ...rest, teacherId: fatima.id }, now)

    expect(findTeacher).toHaveBeenCalledWith('school-1', fatima.id)
    expect(result).toMatchObject({ plan: { teacher: fatima }, matches: { teachers: [fatima] } })
  })

  it('blocks an ambiguous name without writing a draft', async () => {
    const result = await previewRecordTeacherExpense(scope, { ...input, teacherName: 'Ali' }, now)

    expect(result).toMatchObject({
      draftId: null,
      matches: { teachers: [amina, fatima] },
      blockers: [{ field: 'teacherName', value: 'Ali', reason: 'ambiguousTeacher' }],
    })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks an archived or foreign teacher id as not found', async () => {
    findTeacher.mockResolvedValue(null)
    const { teacherName: _, ...rest } = input

    const result = await previewRecordTeacherExpense(scope, { ...rest, teacherId: fatima.id }, now)

    expect(result).toMatchObject({
      blockers: [{ field: 'teacherId', value: fatima.id, reason: 'notFound' }],
    })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('warns about an identical note the same day and a payment dated before the request', async () => {
    findSimilarExpenses.mockResolvedValue([{ id: 'exp-1' }])

    const result = await previewRecordTeacherExpense(scope, { ...input, paidAt: '2026-09-10' }, now)

    expect(result).toMatchObject({
      draftId: 'draft-1',
      warnings: [
        { field: 'paidAt', value: '2026-09-10', reason: 'paidBeforeRequested' },
        { field: 'amount', value: 'exp-1', reason: 'possibleDuplicateExpense' },
      ],
    })
  })

  it('refuses when the school has not opted into expense notes', async () => {
    isTeacherExpensesEnabled.mockResolvedValue(false)

    const result = await previewRecordTeacherExpense(scope, input, now)

    expect(result).toBe('notConfigured')
    expect(listTeachers).not.toHaveBeenCalled()
  })

  it.each([
    { ...input, teacherId: fatima.id },
    { ...input, teacherName: undefined },
    { ...input, amount: 12.345 },
    { ...input, amount: -5 },
    { ...input, requestedAt: '2026-09-12T10:00:00+02:00' },
  ])('refuses a malformed request without reading anything', async (bad) => {
    const result = await previewRecordTeacherExpense(scope, bad, now)

    expect(result).toBe('validationError')
    expect(isTeacherExpensesEnabled).not.toHaveBeenCalled()
  })
})
