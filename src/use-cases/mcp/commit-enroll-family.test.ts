import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()

const tx = {
  family: { create: vi.fn() },
  person: { create: vi.fn() },
  student: { create: vi.fn() },
  enrollment: { create: vi.fn() },
  classPeriod: { findUnique: vi.fn() },
  classAssignment: { create: vi.fn(), count: vi.fn() },
  payment: { create: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

const { commitEnrollFamily } = await import('./commit-enroll-family')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
}

const resolved = {
  tool: 'enroll_family',
  family: { name: 'Bouhahima', createdById: 'user-1' },
  parents: [{ name: 'Anliati', lastname: 'IKIBALA', sex: 'FEMALE', phoneNumber: '0600000000' }],
  students: [
    { name: 'Mayza', lastname: 'BOURAHIMA', sex: 'FEMALE', birthday: '2018-04-02T00:00:00.000Z' },
  ],
  classPeriod: { id: 'class-1', name: 'C4' },
  plan: { id: 'plan-1', name: 'Tarif annuel', amount: 100 },
  discount: 0,
  totalAmount: 100,
  payment: {
    amount: 100,
    method: 'CARD',
    reference: '34-36',
    paidAt: '2026-09-12T00:00:00.000Z',
    allocation: [{ studentIndex: 0, amount: 100 }],
  },
}

const input = { draftId: '11111111-1111-4111-8111-111111111111', checksum: 'abcdef012345' }

beforeEach(() => {
  vi.clearAllMocks()
  claim.mockResolvedValue({ count: 1 })
  reclaim.mockResolvedValue({ count: 0 })
  findById.mockResolvedValue({
    keyId: 'key-1',
    tool: 'enroll_family',
    checksum: input.checksum,
    resolved,
  })
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  tx.classPeriod.findUnique.mockResolvedValue({ capacity: 12 })
  tx.classAssignment.count.mockResolvedValue(3)
  tx.mcpDraft.updateMany.mockResolvedValue({ count: 1 })
  tx.family.create.mockResolvedValue({ id: 'family-1' })
  tx.person.create
    .mockResolvedValueOnce({ id: 'person-parent' })
    .mockResolvedValueOnce({ id: 'person-student' })
  tx.student.create.mockResolvedValue({ id: 'student-1' })
  tx.enrollment.create.mockResolvedValue({ id: 'enrollment-1' })
  tx.classAssignment.create.mockResolvedValue({ id: 'assignment-1' })
  tx.payment.create.mockResolvedValue({ id: 'payment-1' })
})

describe('commitEnrollFamily', () => {
  it('writes family, people, student, enrollment, assignment and payment in one transaction', async () => {
    const result = await commitEnrollFamily(scope, input)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      familyId: 'family-1',
      parentIds: ['person-parent'],
      personIds: ['person-student'],
      studentIds: ['student-1'],
      enrollmentIds: ['enrollment-1'],
      paymentIds: ['payment-1'],
    })
  })

  it('scopes every write to the school carried by the key', async () => {
    await commitEnrollFamily(scope, input)

    for (const create of [
      tx.family.create,
      tx.student.create,
      tx.enrollment.create,
      tx.classAssignment.create,
      tx.payment.create,
    ]) {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ schoolId: 'school-1' }) })
      )
    }

    expect(tx.person.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schoolId: 'school-1' }) })
    )
  })

  it('leaves the school out of the nested creates, which Prisma fills from the person', async () => {
    await commitEnrollFamily(scope, input)

    for (const call of tx.person.create.mock.calls) {
      const { families, phoneNumbers } = call[0].data
      expect(families.create).not.toHaveProperty('schoolId')
      if (phoneNumbers) expect(phoneNumbers.create).not.toHaveProperty('schoolId')
    }
  })

  it('takes the lock before opening the transaction, never after', async () => {
    const order: string[] = []
    claim.mockImplementation(async () => {
      order.push('claim')
      return { count: 1 }
    })
    transaction.mockImplementation(async (run: (client: typeof tx) => unknown) => {
      order.push('transaction')
      return run(tx)
    })

    await commitEnrollFamily(scope, input)

    expect(order).toEqual(['claim', 'transaction'])
  })

  it('writes the result inside the transaction that writes the family', async () => {
    const result = await commitEnrollFamily(scope, input)

    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: input.draftId, schoolId: 'school-1' },
      data: { result },
    })
  })

  it('refuses a class that filled up between the preview and the commit', async () => {
    tx.classAssignment.count.mockResolvedValue(12)

    expect(await commitEnrollFamily(scope, input)).toBe('classFull')
    expect(tx.family.create).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('counts the seats the siblings already took before judging the last one', async () => {
    await commitEnrollFamily(scope, input)

    expect(tx.classAssignment.count).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-1',
        classPeriodId: 'class-1',
        endAt: null,
        enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
      },
    })
  })

  it('refuses a stored split that points past the students it creates', async () => {
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        payment: { ...resolved.payment, allocation: [{ studentIndex: 4, amount: 100 }] },
      },
    })

    expect(await commitEnrollFamily(scope, input)).toBe('validationError')
    expect(transaction).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('gives the lock back when the transaction blows up', async () => {
    transaction.mockRejectedValue(new Error('connection lost'))

    await expect(commitEnrollFamily(scope, input)).rejects.toThrow('connection lost')
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('takes over a lock left behind by a commit that never wrote anything', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById
      .mockResolvedValueOnce({
        keyId: 'key-1',
        tool: 'enroll_family',
        checksum: input.checksum,
        status: 'COMMITTED',
        result: null,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({
        keyId: 'key-1',
        tool: 'enroll_family',
        checksum: input.checksum,
        resolved,
      })
    reclaim.mockResolvedValue({ count: 1 })

    expect(await commitEnrollFamily(scope, input)).toMatchObject({ familyId: 'family-1' })
  })

  it('returns the recorded result on a replay instead of a second family', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'COMMITTED',
      result: { familyId: 'family-1' },
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toEqual({ familyId: 'family-1' })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a checksum that does not match the plan the caller was shown', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: 'ffffffffffff',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('checksumMismatch')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a draft whose deadline has passed', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('draftExpired')
  })

  it('refuses a draft proposed by another key of the same school', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-2',
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('draftNotFound')
    expect(claim).toHaveBeenCalledWith(
      'school-1',
      'key-1',
      input.draftId,
      'enroll_family',
      input.checksum,
      expect.any(Date)
    )
  })

  it('refuses a draft that belongs to the other tool', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('draftNotFound')
  })

  it('refuses an unknown draft', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue(null)

    expect(await commitEnrollFamily(scope, input)).toBe('draftNotFound')
  })

  it('holds off while a concurrent commit is still inside its transaction', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'COMMITTED',
      result: null,
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('commitInProgress')
    expect(reclaim).toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a malformed draft identifier without touching the lock', async () => {
    expect(await commitEnrollFamily(scope, { draftId: 'nope', checksum: 'abcdef012345' })).toBe(
      'validationError'
    )
    expect(claim).not.toHaveBeenCalled()
  })

  it('refuses a stored plan whose shape it can no longer write', async () => {
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {},
    })

    expect(await commitEnrollFamily(scope, input)).toBe('validationError')
    expect(transaction).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })
})
