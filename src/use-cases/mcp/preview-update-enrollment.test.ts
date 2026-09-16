import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOpenForMcp = vi.fn()
const listPlans = vi.fn()
const createDraft = vi.fn()

vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findOpenForMcp } }))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway: { listPlans } }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewUpdateEnrollment } = await import('./preview-update-enrollment')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const basic = { id: 'plan-basic', name: 'Forfait Basic 2026/2027', amount: '180' }
const legacy = { id: 'plan-legacy', name: 'Forfait Basic (2026/2027)', amount: '180' }
const grand = { id: 'plan-grand', name: 'Forfait Grand élèves 2026/2027', amount: '90' }

const enrollment = (overrides: Record<string, unknown> = {}) => ({
  id: 'enr-1',
  status: 'PENDING',
  discount: 0,
  totalAmount: 180,
  plan: legacy,
  student: { person: { name: "Lou'ayy", lastname: 'Ahamada' } },
  classAssignments: [{ classPeriod: { name: 'C3 - 2026/2027' } }],
  payments: [],
  ...overrides,
})

const input = {
  studentName: "Lou'ayy",
  studentLastname: 'Ahamada',
  planName: 'Forfait Basic 2026/2027',
}

beforeEach(() => {
  vi.clearAllMocks()
  findOpenForMcp.mockResolvedValue([enrollment()])
  listPlans.mockResolvedValue([basic, legacy, grand])
  createDraft.mockResolvedValue({ id: 'draft-3' })
})

function assertPreview<T>(result: T): asserts result is Exclude<T, string> {
  if (typeof result === 'string') throw new Error(`expected a preview, got ${result}`)
}

describe('previewUpdateEnrollment', () => {
  it('resolves the move from one plan to another, with the recomputed total', async () => {
    const result = await previewUpdateEnrollment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.plan).toMatchObject({
      tool: 'update_enrollment',
      enrollment: { id: 'enr-1', student: "Lou'ayy Ahamada", classes: ['C3 - 2026/2027'] },
      before: { plan: { id: 'plan-legacy', amount: 180 }, discount: 0, totalAmount: 180 },
      after: { plan: { id: 'plan-basic', amount: 180 }, discount: 0, totalAmount: 180 },
      paid: 0,
      remaining: 180,
    })
    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ tool: 'update_enrollment', keyId: 'key-1' })
    )
  })

  it('refuses without reading an enrollment or proposing a draft when payments are disabled', async () => {
    const result = await previewUpdateEnrollment({ ...scope, paymentsEnabled: false }, input)

    expect(result).toBe('paymentsDisabled')
    expect(findOpenForMcp).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('searches the enrollment by student name, or by identifier when given', async () => {
    await previewUpdateEnrollment(scope, input)
    expect(findOpenForMcp).toHaveBeenCalledWith('school-1', {
      name: "Lou'ayy",
      lastname: 'Ahamada',
    })

    const id = '11111111-1111-4111-8111-111111111111'
    await previewUpdateEnrollment(scope, { enrollmentId: id, discount: 90 })
    expect(findOpenForMcp).toHaveBeenLastCalledWith('school-1', { id })
  })

  it('keeps the existing discount when only the plan changes', async () => {
    findOpenForMcp.mockResolvedValue([enrollment({ discount: 20, totalAmount: 160 })])

    const result = await previewUpdateEnrollment(scope, { ...input, planName: grand.name })
    assertPreview(result)

    expect(result.plan?.after).toEqual({
      plan: { id: 'plan-grand', name: grand.name, amount: 90 },
      discount: 20,
      totalAmount: 70,
    })
  })

  it('applies a discount alone on the current plan', async () => {
    findOpenForMcp.mockResolvedValue([enrollment({ plan: basic, payments: [{ amount: 50 }] })])

    const { planName: _planName, ...byName } = input
    const result = await previewUpdateEnrollment(scope, { ...byName, discount: 90 })
    assertPreview(result)

    expect(listPlans).not.toHaveBeenCalled()
    expect(result.plan).toMatchObject({
      after: { plan: { id: 'plan-basic' }, discount: 90, totalAmount: 90 },
      paid: 50,
      remaining: 40,
    })
  })

  it('lists the candidates instead of choosing between two open enrollments', async () => {
    findOpenForMcp.mockResolvedValue([enrollment(), enrollment({ id: 'enr-2' })])

    const result = await previewUpdateEnrollment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'studentName', value: "Lou'ayy Ahamada", reason: 'ambiguousEnrollment' },
    ])
    expect(result.matches.enrollments.map((row) => row.id)).toEqual(['enr-1', 'enr-2'])
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks a student with no open enrollment', async () => {
    findOpenForMcp.mockResolvedValue([])

    const result = await previewUpdateEnrollment(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'studentName', value: "Lou'ayy Ahamada", reason: 'notFound' },
    ])
  })

  it('refuses to pick between plans a label matches only partially', async () => {
    const result = await previewUpdateEnrollment(scope, { ...input, planName: 'Forfait' })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'planName', value: 'Forfait', reason: 'ambiguousPlan' },
    ])
  })

  it('blocks a discount above the target plan', async () => {
    const result = await previewUpdateEnrollment(scope, {
      ...input,
      planName: grand.name,
      discount: 100,
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'discount', value: '100', reason: 'discountExceedsPlan' },
    ])
  })

  it('blocks a total below what the family already paid on the enrollment', async () => {
    findOpenForMcp.mockResolvedValue([enrollment({ payments: [{ amount: 60 }, { amount: 60 }] })])

    const result = await previewUpdateEnrollment(scope, { ...input, planName: grand.name })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'planName', value: grand.name, reason: 'totalBelowPaid' },
    ])
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('refuses a final amount with more than two decimal places', async () => {
    const result = await previewUpdateEnrollment(scope, { ...input, totalAmount: 120.001 })

    expect(result).toBe('validationError')
    expect(findOpenForMcp).not.toHaveBeenCalled()
  })

  it('blocks a request that changes nothing', async () => {
    const result = await previewUpdateEnrollment(scope, { ...input, planName: legacy.name })
    assertPreview(result)

    expect(result.blockers).toEqual([{ field: 'planName', value: legacy.name, reason: 'noChange' }])
  })

  it('recomputes a total the plan price moved away from, even on the same plan', async () => {
    findOpenForMcp.mockResolvedValue([enrollment({ plan: basic, totalAmount: 160 })])

    const result = await previewUpdateEnrollment(scope, { ...input, planName: basic.name })
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.plan?.after.totalAmount).toBe(180)
  })

  it('rejects an input naming neither a change nor an enrollment', async () => {
    expect(await previewUpdateEnrollment(scope, { studentName: 'Nour', planName: 'Basic' })).toBe(
      'validationError'
    )
    expect(
      await previewUpdateEnrollment(scope, { studentName: 'Nour', studentLastname: 'Mlinde' })
    ).toBe('validationError')
  })
})
