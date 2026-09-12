import { beforeEach, describe, expect, it, vi } from 'vitest'

const listClassPeriods = vi.fn()
const listPlans = vi.fn()
const countEnrolled = vi.fn()
const searchFamilies = vi.fn()
const searchPersons = vi.fn()
const findByReference = vi.fn()
const createDraft = vi.fn()

vi.mock('@/use-cases/class-periods/list-class-periods', () => ({ listClassPeriods }))
vi.mock('@/use-cases/plans/list-plans', () => ({ listPlans }))
vi.mock('@/gateways/class-period-gateway', () => ({ classPeriodGateway: { countEnrolled } }))
vi.mock('@/gateways/family-gateway', () => ({ familyGateway: { searchByName: searchFamilies } }))
vi.mock('@/gateways/person-gateway', () => ({ personGateway: { searchByName: searchPersons } }))
vi.mock('@/gateways/payment-gateway', () => ({ paymentGateway: { findByReference } }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewEnrollFamily } = await import('./preview-enroll-family')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
}

const input = {
  familyName: 'Bouhahima',
  parents: [{ name: 'Anliati', lastname: 'IKIBALA', sex: 'FEMALE' as const }],
  students: [
    {
      name: 'Mayza',
      lastname: 'BOURAHIMA',
      sex: 'FEMALE' as const,
      birthday: '2018-04-02',
      className: 'C4',
    },
  ],
  planName: 'Tarif annuel',
  payment: { amount: 100, method: 'CARD' as const, reference: '34-36', paidAt: '2026-09-12' },
}

beforeEach(() => {
  vi.clearAllMocks()
  listClassPeriods.mockResolvedValue([
    { id: 'class-1', name: 'C4', capacity: 20 },
    { id: 'class-2', name: 'C5', capacity: 20 },
  ])
  listPlans.mockResolvedValue([{ id: 'plan-1', name: 'Tarif annuel', amount: 100 }])
  countEnrolled.mockResolvedValue(3)
  searchFamilies.mockResolvedValue([])
  searchPersons.mockResolvedValue([])
  findByReference.mockResolvedValue([])
  createDraft.mockResolvedValue({ id: 'draft-1' })
})

// Un `return` silencieux ferait passer le test sans rien vérifier le jour où le preview
// refuse. L'assertion échoue en nommant le refus, et rétrécit le type au passage.
function assertPreview<T>(result: T): asserts result is Exclude<T, string> {
  if (typeof result === 'string') throw new Error(`expected a preview, got ${result}`)
}

describe('previewEnrollFamily', () => {
  it('resolves labels into identifiers and persists exactly one draft', async () => {
    const result = await previewEnrollFamily(scope, input)

    expect(result).not.toBe('validationError')
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.draftId).toBe('draft-1')
    expect(result.plan?.students[0].classPeriod).toEqual({ id: 'class-1', name: 'C4' })
    expect(result.plan?.plan).toEqual({ id: 'plan-1', name: 'Tarif annuel', amount: 100 })
    expect(createDraft).toHaveBeenCalledTimes(1)
  })

  it('stamps the draft with the presenting key and the enroll tool', async () => {
    await previewEnrollFamily(scope, input)

    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ keyId: 'key-1', tool: 'enroll_family' })
    )
  })

  it('returns a checksum the caller can echo back, over the very plan it was shown', async () => {
    const { draftChecksum } = await import('@/lib/mcp-draft-crypto')
    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.checksum).toBe(draftChecksum(result.plan))
  })

  it('splits the payment across siblings instead of charging one of them', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [
        ...input.students,
        {
          name: 'Manzil',
          lastname: 'BEN',
          sex: 'MALE' as const,
          birthday: '2016-01-10',
          className: 'C4',
        },
      ],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.plan?.payment?.allocation).toEqual([
      { studentIndex: 0, amount: 100 },
      { studentIndex: 1, amount: 100 },
    ])
  })

  it('names an unknown class as a blocker and writes nothing', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [{ ...input.students[0], className: 'Z9' }],
    })
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'students.0.className',
      value: 'Z9',
      reason: 'unknownClass',
    })
    expect(result.draftId).toBeNull()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('refuses to choose between two classes matching the same label', async () => {
    listClassPeriods.mockResolvedValue([
      { id: 'class-1', name: 'C4 matin', capacity: 20 },
      { id: 'class-2', name: 'C4 soir', capacity: 20 },
    ])

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'students.0.className',
      value: 'C4',
      reason: 'ambiguousClass',
    })
  })

  it('blocks a class with no seat left for the whole sibling group', async () => {
    countEnrolled.mockResolvedValue(20)

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'students.className',
      value: 'C4',
      reason: 'classFull',
    })
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks a payment larger than what the enrollments will owe', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      payment: { ...input.payment, amount: 500 },
    })
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'payment.amount',
      value: '500',
      reason: 'overpayment',
    })
  })

  it('blocks a birthday in the future rather than creating a student from it', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [{ ...input.students[0], birthday: '2099-01-01' }],
    })
    assertPreview(result)

    expect(result.blockers.map((blocker) => blocker.reason)).toContain('birthdayNotInThePast')
  })

  it('warns about an existing namesake without blocking the commit', async () => {
    searchFamilies.mockResolvedValue([{ id: 'family-9', name: 'Bouhahima' }])
    searchPersons.mockResolvedValue([
      { id: 'person-9', name: 'Mayza', lastname: 'BOURAHIMA', student: { id: 'student-9' } },
    ])

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.warnings.map((warning) => warning.reason)).toEqual([
      'existingFamily',
      'existingStudent',
    ])
    expect(result.draftId).toBe('draft-1')
  })

  it('warns when the receipt number has already been banked', async () => {
    findByReference.mockResolvedValue([{ id: 'payment-9', amount: 100, paidAt: new Date() }])

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.warnings).toContainEqual({
      field: 'payment.reference',
      value: '34-36',
      reason: 'referenceAlreadyUsed',
    })
  })

  it('seats siblings in the classes their own line names', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [
        input.students[0],
        {
          name: 'Manzil',
          lastname: 'BEN',
          sex: 'MALE' as const,
          birthday: '2016-01-10',
          className: 'C5',
        },
      ],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.plan?.students.map((student) => student.classPeriod)).toEqual([
      { id: 'class-1', name: 'C4' },
      { id: 'class-2', name: 'C5' },
    ])
  })

  it('counts a seat per class visited, not the whole group in each of them', async () => {
    countEnrolled.mockResolvedValue(19)

    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [
        input.students[0],
        {
          name: 'Manzil',
          lastname: 'BEN',
          sex: 'MALE' as const,
          birthday: '2016-01-10',
          className: 'C5',
        },
      ],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(countEnrolled).toHaveBeenCalledWith('school-1', 'class-1')
    expect(countEnrolled).toHaveBeenCalledWith('school-1', 'class-2')
  })

  it('rejects malformed input before reading anything', async () => {
    expect(await previewEnrollFamily(scope, { ...input, students: [] })).toBe('validationError')
    expect(listClassPeriods).not.toHaveBeenCalled()
  })
})
