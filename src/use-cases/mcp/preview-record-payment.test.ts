import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFamilyById = vi.fn()
const searchFamilies = vi.fn()
const findActiveByFamily = vi.fn()
const findByReference = vi.fn()
const createDraft = vi.fn()

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: { findById: findFamilyById, searchByName: searchFamilies },
}))
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findActiveByFamily } }))
vi.mock('@/gateways/payment-gateway', () => ({ paymentGateway: { findByReference } }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewRecordPayment } = await import('./preview-record-payment')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
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
  findActiveByFamily.mockResolvedValue([enrollment('enr-1', 100, 0), enrollment('enr-2', 100, 0)])
  findByReference.mockResolvedValue([])
  createDraft.mockResolvedValue({ id: 'draft-2' })
})

describe('previewRecordPayment', () => {
  it('surfaces the split across active enrollments, which the dashboard never shows', async () => {
    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.blockers).toEqual([])
    expect(result.plan?.allocation).toEqual([
      { enrollmentId: 'enr-1', amount: 90 },
      { enrollmentId: 'enr-2', amount: 90 },
    ])
    expect(result.draftId).toBe('draft-2')
  })

  it('accepts the family by identifier without searching by name', async () => {
    const result = await previewRecordPayment(scope, { ...input, familyId: family.id })
    if (typeof result === 'string') return

    expect(findFamilyById).toHaveBeenCalledWith('school-1', family.id)
    expect(searchFamilies).not.toHaveBeenCalled()
    expect(result.draftId).toBe('draft-2')
  })

  it('stamps the draft with the record tool, so the other commit cannot claim it', async () => {
    await previewRecordPayment(scope, input)

    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ tool: 'record_payment', keyId: 'key-1' })
    )
  })

  it('refuses to choose between two families answering the same name', async () => {
    searchFamilies.mockResolvedValue([family, { id: 'family-9', name: 'Madi Said' }])

    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.blockers).toEqual([
      { field: 'familyName', value: 'Madi', reason: 'ambiguousFamily' },
    ])
    expect(findActiveByFamily).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks an unknown family', async () => {
    searchFamilies.mockResolvedValue([])

    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.blockers).toEqual([{ field: 'familyName', value: 'Madi', reason: 'notFound' }])
  })

  it('blocks a family with nothing left to pay', async () => {
    findActiveByFamily.mockResolvedValue([])

    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.blockers).toContainEqual({
      field: 'amount',
      value: '180',
      reason: 'noActiveEnrollments',
    })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks a payment above the outstanding balance', async () => {
    findActiveByFamily.mockResolvedValue([enrollment('enr-1', 100, 90)])

    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.blockers).toContainEqual({
      field: 'amount',
      value: '180',
      reason: 'overpayment',
    })
  })

  it('warns about a receipt number already banked', async () => {
    findByReference.mockResolvedValue([{ id: 'payment-9', amount: 180, paidAt: new Date() }])

    const result = await previewRecordPayment(scope, input)
    if (typeof result === 'string') return

    expect(result.warnings).toContainEqual({
      field: 'reference',
      value: '34-45',
      reason: 'referenceAlreadyUsed',
    })
    expect(result.draftId).toBe('draft-2')
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
