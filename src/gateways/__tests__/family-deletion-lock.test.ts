import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
const record = (name: string, value: unknown) =>
  vi.fn(async () => {
    calls.push(name)
    return value
  })

const tx = {
  $queryRaw: vi.fn(),
  familyPerson: { findMany: record('familyPerson.findMany', []) },
  student: {
    findMany: record('student.findMany', []),
    deleteMany: record('student.deleteMany', {}),
  },
  enrollment: {
    findMany: record('enrollment.findMany', []),
    deleteMany: record('enrollment.deleteMany', {}),
  },
  attendanceEntry: { deleteMany: record('attendanceEntry.deleteMany', {}) },
  classAssignment: { deleteMany: record('classAssignment.deleteMany', {}) },
  payment: { deleteMany: record('payment.deleteMany', {}) },
  paymentTransaction: { deleteMany: record('paymentTransaction.deleteMany', {}) },
  invitation: { deleteMany: record('invitation.deleteMany', {}) },
  person: { deleteMany: record('person.deleteMany', {}) },
  family: { delete: record('family.delete', {}) },
}

const dbArchivedMock = {
  $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
}

vi.mock('@/lib/db', () => ({ db: {}, dbArchived: dbArchivedMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
const { familyGateway } = await import('../family-gateway')

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  tx.$queryRaw.mockImplementation(async () => {
    calls.push('$queryRaw')
    return [{ id: 'family-1' }]
  })
})

describe('familyGateway.deleteWithRelated lock', () => {
  it('locks the school-scoped family row with FOR UPDATE before any other query', async () => {
    const deleted = await familyGateway.deleteWithRelated('school-1', 'family-1')

    expect(deleted).toBe(true)
    expect(calls[0]).toBe('$queryRaw')
    const [sql, ...params] = tx.$queryRaw.mock.calls[0] as unknown as [string[], ...unknown[]]
    expect(sql.join('?')).toMatch(/FROM "Family"[\s\S]*"schoolId" = \?[\s\S]*FOR UPDATE/)
    expect(sql.join('?')).not.toContain('isActive')
    expect(params).toEqual(['family-1', 'school-1'])
    expect(calls.at(-1)).toBe('family.delete')
  })

  it('touches nothing when the family is already gone', async () => {
    tx.$queryRaw.mockResolvedValue([])

    const deleted = await familyGateway.deleteWithRelated('school-1', 'family-1')

    expect(deleted).toBe(false)
    expect(calls).toEqual([])
  })
})
