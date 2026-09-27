import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFamilyById = vi.fn()
const searchFamilies = vi.fn()
const findFamiliesByStudent = vi.fn()
const findPayableByFamily = vi.fn()
const findByReference = vi.fn()
const createDraft = vi.fn()

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: {
    findById: findFamilyById,
    searchByName: searchFamilies,
    findByStudent: findFamiliesByStudent,
  },
}))
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findPayableByFamily } }))
vi.mock('@/gateways/payment-gateway', () => ({ paymentGateway: { findByReference } }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewRecordPayment } = await import('./preview-record-payment')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const family = { id: '22222222-2222-4222-8222-222222222222', name: 'Madi' }

const input = {
  familyName: 'Madi',
  amount: 180,
  method: 'CASH' as const,
  reference: '34-45',
  paidAt: '2026-09-12',
}

const enrollment = (id: string, total: number, paid: number) => ({
  id,
  totalAmount: total,
  discount: 0,
  payments: paid > 0 ? [{ amount: paid }] : [],
})

beforeEach(() => {
  vi.clearAllMocks()
  findFamilyById.mockResolvedValue(family)
  searchFamilies.mockResolvedValue([family])
  findFamiliesByStudent.mockResolvedValue([family])
  findPayableByFamily.mockResolvedValue([enrollment('enr-1', 100, 0), enrollment('enr-2', 100, 0)])
  findByReference.mockResolvedValue([])
  createDraft.mockResolvedValue({ id: 'draft-2' })
})

// Un `return` silencieux ferait passer le test sans rien vérifier le jour où le preview
// refuse. L'assertion échoue en nommant le refus, et rétrécit le type au passage.
function assertPreview<T>(result: T): asserts result is Exclude<T, string> {
  if (typeof result === 'string') throw new Error(`expected a preview, got ${result}`)
}

describe('previewRecordPayment', () => {
  it('surfaces the split across active enrollments, which the dashboard never shows', async () => {
    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.plan?.allocation).toEqual([
      { enrollmentId: 'enr-1', amount: 90 },
      { enrollmentId: 'enr-2', amount: 90 },
    ])
    expect(result.draftId).toBe('draft-2')
  })

  it('accepts the family by identifier without searching by name', async () => {
    const result = await previewRecordPayment(scope, { ...input, familyId: family.id })
    assertPreview(result)

    expect(findFamilyById).toHaveBeenCalledWith('school-1', family.id)
    expect(searchFamilies).not.toHaveBeenCalled()
    expect(result.draftId).toBe('draft-2')
  })

  it('refuses without reading a family or proposing a draft when payments are disabled', async () => {
    const result = await previewRecordPayment({ ...scope, paymentsEnabled: false }, input)

    expect(result).toBe('paymentsDisabled')
    expect(findFamilyById).not.toHaveBeenCalled()
    expect(searchFamilies).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('stamps the draft with the record tool, so the other commit cannot claim it', async () => {
    await previewRecordPayment(scope, input)

    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        tool: 'record_payment',
        owner: { kind: 'MCP_KEY', keyId: 'key-1' },
      })
    )
  })

  it('refuses to choose between two families answering the same name', async () => {
    searchFamilies.mockResolvedValue([family, { id: 'family-9', name: 'Madi Said' }])

    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'familyName', value: 'Madi', reason: 'ambiguousFamily' },
    ])
    expect(findPayableByFamily).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks an unknown family', async () => {
    searchFamilies.mockResolvedValue([])

    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([{ field: 'familyName', value: 'Madi', reason: 'notFound' }])
  })

  it('blocks a family with nothing left to pay', async () => {
    findPayableByFamily.mockResolvedValue([])

    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'amount',
      value: '180',
      reason: 'noPayableEnrollments',
    })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks a payment above the outstanding balance', async () => {
    findPayableByFamily.mockResolvedValue([enrollment('enr-1', 100, 90)])

    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'amount',
      value: '180',
      reason: 'overpayment',
    })
  })

  it('warns about a receipt number already banked', async () => {
    findByReference.mockResolvedValue([{ id: 'payment-9', amount: 180, paidAt: new Date() }])

    const result = await previewRecordPayment(scope, input)
    assertPreview(result)

    expect(result.warnings).toContainEqual({
      field: 'reference',
      value: '34-45',
      reason: 'referenceAlreadyUsed',
    })
    expect(result.draftId).toBe('draft-2')
  })

  it('defaults to the whole remaining balance, in cash, today', async () => {
    findPayableByFamily.mockResolvedValue([
      enrollment('enr-1', 100, 40),
      enrollment('enr-2', 100, 0),
    ])

    const result = await previewRecordPayment(
      scope,
      { familyId: family.id },
      () => new Date('2026-09-27T10:00:00.000Z')
    )
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.plan).toMatchObject({
      amount: 160,
      method: 'CASH',
      paidAt: '2026-09-27T10:00:00.000Z',
      allocation: [
        { enrollmentId: 'enr-1', amount: 60 },
        { enrollmentId: 'enr-2', amount: 100 },
      ],
    })
  })

  it('blocks the default amount when the family owes nothing', async () => {
    findPayableByFamily.mockResolvedValue([enrollment('enr-1', 100, 100)])

    const result = await previewRecordPayment(scope, { familyId: family.id })
    assertPreview(result)

    expect(result.blockers).toContainEqual({ field: 'amount', value: '0', reason: 'nothingDue' })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('resolves the family from one of its students', async () => {
    const studentId = '33333333-3333-4333-8333-333333333333'

    const result = await previewRecordPayment(scope, { studentId })
    assertPreview(result)

    expect(findFamiliesByStudent).toHaveBeenCalledWith('school-1', studentId)
    expect(searchFamilies).not.toHaveBeenCalled()
    expect(result.draftId).toBe('draft-2')
  })

  it('refuses to choose between the families of a shared student', async () => {
    const studentId = '33333333-3333-4333-8333-333333333333'
    findFamiliesByStudent.mockResolvedValue([family, { id: 'family-9', name: 'Said' }])

    const result = await previewRecordPayment(scope, { studentId })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'studentId', value: studentId, reason: 'ambiguousFamily' },
    ])
    expect(result.matches?.families).toHaveLength(2)
  })

  it('rejects an input naming no family at all', async () => {
    expect(
      await previewRecordPayment(scope, { amount: 10, method: 'CASH', paidAt: '2026-09-12' })
    ).toBe('validationError')
  })

  it('rejects a cash date on anything but a cheque', async () => {
    expect(await previewRecordPayment(scope, { ...input, cashedAt: '2026-09-20' })).toBe(
      'validationError'
    )
  })
})
