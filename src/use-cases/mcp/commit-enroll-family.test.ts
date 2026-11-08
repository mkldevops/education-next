import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()

const tx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  family: { create: vi.fn(), findFirst: vi.fn() },
  person: { create: vi.fn(), findFirst: vi.fn() },
  student: { create: vi.fn() },
  enrollment: { create: vi.fn() },
  plan: { findFirst: vi.fn() },
  classPeriod: { findUnique: vi.fn() },
  classAssignment: { create: vi.fn(), count: vi.fn() },
  payment: { create: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))
const issueTuitionReceipt = vi.fn()
vi.mock('@/use-cases/receipts/issue-tuition-receipt', () => ({ issueTuitionReceipt }))

const { commitEnrollFamily } = await import('./commit-enroll-family')

const scope = {
  credentialId: 'key-1',
  credentialPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const resolved = {
  tool: 'enroll_family',
  family: { name: 'Bouhahima', createdById: 'user-1' },
  parents: [{ name: 'Anliati', lastname: 'IKIBALA', sex: 'FEMALE', phoneNumber: '0600000000' }],
  students: [
    {
      name: 'Mayza',
      lastname: 'BOURAHIMA',
      sex: 'FEMALE',
      birthday: '2018-04-02T00:00:00.000Z',
      classPeriod: { id: 'class-1', name: 'C4' },
      plan: { id: 'plan-1', name: 'Tarif annuel', amount: 100 },
      totalAmount: 100,
    },
  ],
  discount: 0,
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
  issueTuitionReceipt.mockResolvedValue({ id: 'receipt-1' })
  claim.mockResolvedValue({ count: 1 })
  reclaim.mockResolvedValue({ count: 0 })
  findById.mockResolvedValue({
    ownerKind: 'MCP_KEY',
    keyId: 'key-1',
    userId: null,
    tool: 'enroll_family',
    checksum: input.checksum,
    resolved,
  })
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  tx.classPeriod.findUnique.mockResolvedValue({ periodId: 'period-1' })
  // La base répond au prix que le brouillon a photographié : chaque test de refus fait
  // bouger ou disparaître une formule explicitement.
  const planAmounts: Record<string, number> = { 'plan-1': 100, 'plan-2': 90, 'plan-unpriced': 0 }
  tx.plan.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id in planAmounts ? { amount: planAmounts[where.id] } : null
  )
  tx.$queryRaw.mockResolvedValue([{ capacity: 12 }])
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
      receiptId: 'receipt-1',
    })
    expect(issueTuitionReceipt).toHaveBeenCalledWith(
      tx,
      'school-1',
      expect.objectContaining({
        familyId: 'family-1',
        recordedById: 'user-1',
        idempotencyKey: `mcp:${input.draftId}`,
        payments: [{ id: 'payment-1', amount: 100 }],
      })
    )
  })

  it('creates the enrollment active, without a separate activation step', async () => {
    await commitEnrollFamily(scope, input)

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })

  it('writes the start month the preview resolved, and none for an older draft', async () => {
    await commitEnrollFamily(scope, input)
    expect(tx.enrollment.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ startMonth: null }) })
    )

    vi.clearAllMocks()
    transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
    claim.mockResolvedValue({ count: 1 })
    tx.person.create
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student' })
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [{ ...resolved.students[0], startMonth: '2026-10' }],
      },
    })

    await commitEnrollFamily(scope, input)
    expect(tx.enrollment.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startMonth: new Date('2026-10-01T00:00:00.000Z') }),
      })
    )
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

  it('counts occupancy with the predicate create-enrollment uses', async () => {
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

  it.each([
    { enrolled: 11, expected: 'classFull' },
    { enrolled: 10, expected: 'OK' },
  ])(
    'judges two siblings sharing a class on both seats ($enrolled enrolled of 12)',
    async ({ enrolled, expected }) => {
      tx.classAssignment.count.mockResolvedValue(enrolled)
      findById.mockResolvedValue({
        ownerKind: 'MCP_KEY',
        keyId: 'key-1',
        userId: null,
        tool: 'enroll_family',
        checksum: input.checksum,
        resolved: {
          ...resolved,
          students: [
            resolved.students[0],
            {
              name: 'Manzil',
              lastname: 'BEN',
              sex: 'MALE',
              birthday: '2016-01-10T00:00:00.000Z',
              classPeriod: { id: 'class-1', name: 'C4' },
              plan: resolved.students[0].plan,
              totalAmount: 100,
            },
          ],
        },
      })
      tx.person.create
        .mockReset()
        .mockResolvedValueOnce({ id: 'person-parent' })
        .mockResolvedValueOnce({ id: 'person-student-1' })
        .mockResolvedValueOnce({ id: 'person-student-2' })

      const result = await commitEnrollFamily(scope, input)

      expect(tx.classAssignment.count).toHaveBeenCalledTimes(1)
      if (expected === 'classFull') {
        expect(result).toBe('classFull')
        expect(tx.family.create).not.toHaveBeenCalled()
      } else {
        expect(result).toMatchObject({ familyId: 'family-1' })
      }
    }
  )

  it('seats each sibling in its own class and counts each class once', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          resolved.students[0],
          {
            name: 'Manzil',
            lastname: 'BEN',
            sex: 'MALE',
            birthday: '2016-01-10T00:00:00.000Z',
            classPeriod: { id: 'class-2', name: 'C2' },
            plan: resolved.students[0].plan,
            totalAmount: 100,
          },
        ],
      },
    })
    tx.person.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student-1' })
      .mockResolvedValueOnce({ id: 'person-student-2' })

    await commitEnrollFamily(scope, input)

    expect(tx.classAssignment.count).toHaveBeenCalledTimes(2)
    expect(tx.classAssignment.create.mock.calls.map((call) => call[0].data.classPeriodId)).toEqual([
      'class-1',
      'class-2',
    ])
  })

  it('writes each enrollment on the plan and total its own student carries', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          resolved.students[0],
          {
            name: 'Manzil',
            lastname: 'BEN',
            classPeriod: { id: 'class-2', name: 'C2' },
            plan: { id: 'plan-2', name: 'Forfait Grand élèves', amount: 90 },
            totalAmount: 90,
          },
        ],
      },
    })
    tx.person.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student-1' })
      .mockResolvedValueOnce({ id: 'person-student-2' })

    await commitEnrollFamily(scope, input)

    expect(
      tx.enrollment.create.mock.calls.map(({ 0: { data } }) => [data.planId, data.totalAmount])
    ).toEqual([
      ['plan-1', 100],
      ['plan-2', 90],
    ])
  })

  it('judges each class on the seats its own siblings take, not the whole group', async () => {
    tx.$queryRaw.mockResolvedValue([{ capacity: 4 }])
    tx.classAssignment.count.mockResolvedValue(3)
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          resolved.students[0],
          {
            name: 'Manzil',
            lastname: 'BEN',
            sex: 'MALE',
            birthday: '2016-01-10T00:00:00.000Z',
            classPeriod: { id: 'class-2', name: 'C2' },
            plan: resolved.students[0].plan,
            totalAmount: 100,
          },
        ],
      },
    })
    tx.person.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student-1' })
      .mockResolvedValueOnce({ id: 'person-student-2' })

    expect(await commitEnrollFamily(scope, input)).toMatchObject({ familyId: 'family-1' })
  })

  it('locks the class rows in id order and counts under the lock', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          { ...resolved.students[0], classPeriod: { id: 'class-b', name: 'C5' } },
          { ...resolved.students[0], name: 'Manzil', classPeriod: { id: 'class-a', name: 'C2' } },
        ],
        payment: null,
      },
    })
    tx.person.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student-1' })
      .mockResolvedValueOnce({ id: 'person-student-2' })

    await commitEnrollFamily(scope, input)

    // Deux commits qui visent les mêmes classes les verrouillent dans le même ordre.
    const lockedIds = tx.$queryRaw.mock.calls.map(([sql, ...values]) => {
      expect(sql.join('?')).toContain('FOR UPDATE')
      return values[0]
    })
    expect(lockedIds).toEqual(['class-a', 'class-b'])
    const lastLock = tx.$queryRaw.mock.invocationCallOrder.at(-1) ?? 0
    expect(lastLock).toBeLessThan(tx.classAssignment.count.mock.invocationCallOrder.at(-1) ?? 0)
  })

  it('refuses a class archived between the preview and the commit', async () => {
    tx.$queryRaw.mockResolvedValue([])

    expect(await commitEnrollFamily(scope, input)).toBe('notFound')
    expect(tx.family.create).not.toHaveBeenCalled()
  })

  // Archiver une formule est autorisé tant qu'aucune inscription ouverte ne la porte, et
  // celle du brouillon n'existe pas encore : le commit doit la relire, pas la croire.
  it('refuses a plan archived between the preview and the commit', async () => {
    tx.plan.findFirst.mockResolvedValue(null)

    expect(await commitEnrollFamily(scope, input)).toBe('notFound')
    expect(tx.plan.findFirst).toHaveBeenCalledWith({
      where: { id: 'plan-1', schoolId: 'school-1', isActive: true },
      select: { amount: true },
    })
    expect(tx.family.create).not.toHaveBeenCalled()
    expect(tx.enrollment.create).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('refuses a plan whose price moved since the preview', async () => {
    tx.plan.findFirst.mockResolvedValue({ amount: 120 })

    expect(await commitEnrollFamily(scope, input)).toBe('staleDraft')
    expect(tx.family.create).not.toHaveBeenCalled()
    expect(tx.enrollment.create).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('re-reads each plan once, before the first write', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          resolved.students[0],
          { ...resolved.students[0], name: 'Manzil', classPeriod: { id: 'class-2', name: 'C2' } },
          {
            ...resolved.students[0],
            name: 'Nour',
            classPeriod: { id: 'class-2', name: 'C2' },
            plan: { id: 'plan-2', name: 'Forfait Grand élèves', amount: 90 },
            totalAmount: 90,
          },
        ],
        payment: null,
      },
    })
    tx.person.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'person-parent' })
      .mockResolvedValueOnce({ id: 'person-student-1' })
      .mockResolvedValueOnce({ id: 'person-student-2' })
      .mockResolvedValueOnce({ id: 'person-student-3' })

    expect(await commitEnrollFamily(scope, input)).toMatchObject({ familyId: 'family-1' })

    expect(tx.plan.findFirst.mock.calls.map(([args]) => args.where.id)).toEqual([
      'plan-1',
      'plan-2',
    ])
    const lastPlanRead = tx.plan.findFirst.mock.invocationCallOrder.at(-1) ?? 0
    expect(lastPlanRead).toBeLessThan(tx.family.create.mock.invocationCallOrder[0] ?? 0)
  })

  it('refuses a stored split that points past the students it creates', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
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
        ownerKind: 'MCP_KEY',
        keyId: 'key-1',
        userId: null,
        tool: 'enroll_family',
        checksum: input.checksum,
        status: 'COMMITTED',
        result: null,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({
        ownerKind: 'MCP_KEY',
        keyId: 'key-1',
        userId: null,
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
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
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
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
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
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
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
      ownerKind: 'MCP_KEY',
      keyId: 'key-2',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitEnrollFamily(scope, input)).toBe('draftNotFound')
    expect(claim).toHaveBeenCalledWith(
      'school-1',
      { kind: 'MCP_KEY', keyId: 'key-1' },
      input.draftId,
      'enroll_family',
      input.checksum,
      expect.any(Date)
    )
  })

  it('refuses a draft that belongs to the other tool', async () => {
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
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
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

  describe('on an existing family', () => {
    const attached = {
      ...resolved,
      family: { id: 'family-7', name: 'Chanrani / Ahamada' },
      parents: [],
      students: [
        {
          name: 'Mouhammad Djamil',
          lastname: 'Ahamada',
          personId: 'person-7',
          studentId: 'student-7',
          classPeriod: { id: 'class-1', name: 'C4' },
          plan: { id: 'plan-1', name: 'Tarif annuel', amount: 100 },
          totalAmount: 100,
        },
      ],
      payment: null,
    }

    beforeEach(() => {
      findById.mockResolvedValue({
        ownerKind: 'MCP_KEY',
        keyId: 'key-1',
        userId: null,
        tool: 'enroll_family',
        checksum: input.checksum,
        resolved: attached,
      })
      tx.family.findFirst.mockResolvedValue({ id: 'family-7' })
      tx.person.findFirst.mockResolvedValue({
        student: { id: 'student-7', isActive: true, enrollments: [] },
      })
    })

    it('enrolls the existing student without creating a family, person or student', async () => {
      const result = await commitEnrollFamily(scope, input)

      expect(tx.family.create).not.toHaveBeenCalled()
      expect(tx.person.create).not.toHaveBeenCalled()
      expect(tx.student.create).not.toHaveBeenCalled()
      expect(tx.person.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'person-7',
            schoolId: 'school-1',
            families: { some: { familyId: 'family-7', relationType: { not: 'PARENT' } } },
          }),
        })
      )
      expect(tx.enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ studentId: 'student-7' }) })
      )
      expect(result).toMatchObject({ familyId: 'family-7', studentIds: ['student-7'] })
    })

    it('locks the student in the period before the class row', async () => {
      await commitEnrollFamily(scope, input)

      const [studentLock] = tx.$executeRaw.mock.invocationCallOrder
      const [familyLock, classLock] = tx.$queryRaw.mock.invocationCallOrder
      expect(familyLock).toBeLessThan(studentLock)
      expect(tx.$executeRaw.mock.calls[0]).toContain('enrollment:school-1:student-7:period-1')
      expect(studentLock).toBeLessThan(classLock)
    })

    it('refuses a family archived since the preview', async () => {
      tx.family.findFirst.mockResolvedValue(null)

      expect(await commitEnrollFamily(scope, input)).toBe('notFound')
      expect(tx.enrollment.create).not.toHaveBeenCalled()
      expect(release).toHaveBeenCalledWith('school-1', input.draftId)
    })

    it('refuses a student enrolled since the preview', async () => {
      tx.person.findFirst.mockResolvedValue({
        student: { id: 'student-7', isActive: true, enrollments: [{ id: 'enr-9' }] },
      })

      expect(await commitEnrollFamily(scope, input)).toBe('duplicateEnrollment')
      expect(tx.enrollment.create).not.toHaveBeenCalled()
    })

    it('refuses a member who left the family or became a student since the preview', async () => {
      tx.person.findFirst.mockResolvedValueOnce(null)
      expect(await commitEnrollFamily(scope, input)).toBe('notFound')

      tx.person.findFirst.mockResolvedValueOnce({
        student: { id: 'student-8', isActive: true, enrollments: [] },
      })
      expect(await commitEnrollFamily(scope, input)).toBe('staleDraft')
      expect(tx.enrollment.create).not.toHaveBeenCalled()
    })
  })

  it('rejects a malformed draft identifier without touching the lock', async () => {
    expect(await commitEnrollFamily(scope, { draftId: 'nope', checksum: 'abcdef012345' })).toBe(
      'validationError'
    )
    expect(claim).not.toHaveBeenCalled()
  })

  it('refuses a stored plan whose shape it can no longer write', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {},
    })

    expect(await commitEnrollFamily(scope, input)).toBe('validationError')
    expect(transaction).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  // Le brouillon posé pendant une coupure des paiements porte la formule réservée et des
  // montants nuls, sans bloc `payment` : le schéma du brouillon résolu doit l'accepter
  // sans relâcher la validation du cas nominal couvert par les autres tests.
  it('writes an unpriced draft with zero amounts and no payment', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          {
            ...resolved.students[0],
            plan: { id: 'plan-unpriced', name: '__unpriced__', amount: 0 },
            totalAmount: 0,
          },
        ],
        payment: null,
      },
    })

    const result = await commitEnrollFamily(scope, input)

    expect(result).not.toBe('validationError')
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'plan-unpriced', totalAmount: 0 }),
      })
    )
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  // FR-024 : le brouillon a été préparé drapeau actif, l'école a coupé entre-temps. Il porte
  // un encaissement et des totaux tarifés que plus aucun écran ne restituerait.
  it('refuses a money-carrying draft once the school cut payments off', async () => {
    const result = await commitEnrollFamily({ ...scope, paymentsEnabled: false }, input)

    expect(result).toBe('paymentsDisabled')
    expect(transaction).not.toHaveBeenCalled()
    // Rendu et non consommé : les paiements revenus, le brouillon reste engageable.
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  // La contrepartie : inscrire sans argent reste ouvert drapeau coupé, sinon le drapeau
  // fermerait la fonction qu'il est censé rendre possible.
  it('still commits an unpriced draft while payments are off', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'enroll_family',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        students: [
          {
            ...resolved.students[0],
            plan: { id: 'plan-unpriced', name: '__unpriced__', amount: 0 },
            totalAmount: 0,
          },
        ],
        payment: null,
      },
    })

    const result = await commitEnrollFamily({ ...scope, paymentsEnabled: false }, input)

    expect(result).not.toBe('paymentsDisabled')
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'plan-unpriced', totalAmount: 0 }),
      })
    )
  })
})
