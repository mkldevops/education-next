import { beforeEach, describe, expect, it, vi } from 'vitest'

const listClassPeriods = vi.fn()
const listPlans = vi.fn()
const mcpReadGateway = { listClassPeriods, listPlans }
const countEnrolled = vi.fn()
const searchFamilies = vi.fn()
const searchPersons = vi.fn()
const findByReference = vi.fn()
const createDraft = vi.fn()

vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway }))
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

const sibling = {
  name: 'Manzil',
  lastname: 'BEN',
  sex: 'MALE' as const,
  birthday: '2016-01-10',
  className: 'C4',
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

  it('blocks a class with no seat left', async () => {
    countEnrolled.mockResolvedValue(20)

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'students.0.className',
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

  // Les homonymes partent dans le contexte du fournisseur de modèle. Le gateway est celui du
  // dashboard : la ligne rendue ici porte volontairement plus que ce que le MCP publie, et le
  // test échoue le jour où une colonne la suit.
  it('publishes a namesake as a name and an already-a-student flag, nothing more', async () => {
    searchFamilies.mockResolvedValue([
      { id: 'family-9', name: 'Bouhahima', createdAt: new Date('2020-01-01') },
    ])
    searchPersons.mockResolvedValue([
      {
        id: 'person-9',
        name: 'Mayza',
        lastname: 'BOURAHIMA',
        student: { id: 'student-9', birthday: new Date('2018-04-02') },
      },
      { id: 'person-8', name: 'Mayza', lastname: 'BOURAHIMA', student: null },
    ])

    const result = await previewEnrollFamily(scope, input)
    assertPreview(result)

    expect(result.matches).toEqual({
      families: [{ id: 'family-9', name: 'Bouhahima' }],
      students: [
        { id: 'person-9', name: 'Mayza', lastname: 'BOURAHIMA', isStudent: true },
        { id: 'person-8', name: 'Mayza', lastname: 'BOURAHIMA', isStudent: false },
      ],
    })
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

  it('names the sibling whose class label failed, not the first one', async () => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [input.students[0], { ...sibling, className: 'Z9' }],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toContainEqual({
      field: 'students.1.className',
      value: 'Z9',
      reason: 'unknownClass',
    })
  })

  it('blocks two siblings sharing a class that has a single seat left', async () => {
    countEnrolled.mockResolvedValue(19)

    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [input.students[0], sibling],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'students.0.className', value: 'C4', reason: 'classFull' },
      { field: 'students.1.className', value: 'C4', reason: 'classFull' },
    ])
    expect(countEnrolled).toHaveBeenCalledTimes(1)
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('seats two siblings sharing a class that has exactly two seats left', async () => {
    countEnrolled.mockResolvedValue(18)

    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [input.students[0], sibling],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.draftId).toBe('draft-1')
  })

  it('blocks only the siblings seated in the full class', async () => {
    countEnrolled.mockImplementation(async (_schoolId: string, id: string) =>
      id === 'class-1' ? 20 : 3
    )

    const result = await previewEnrollFamily(scope, {
      ...input,
      students: [input.students[0], { ...sibling, className: 'C5' }],
      payment: { ...input.payment, amount: 200 },
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'students.0.className', value: 'C4', reason: 'classFull' },
    ])
  })

  it.each([
    '2026-09-12',
    '2026-09-12T14:30:00Z',
    '2026-09-12T14:30:00.000Z',
    '2026-09-12T14:30:00+02:00',
  ])('accepts %s as a payment date', async (paidAt) => {
    const result = await previewEnrollFamily(scope, {
      ...input,
      payment: { ...input.payment, paidAt },
    })

    expect(result).not.toBe('validationError')
  })

  it.each([
    ['a French day-first date', { paidAt: '12/09/2026' }],
    ['a timestamp with no zone', { paidAt: '2026-09-12T14:30:00' }],
  ])('refuses %s as a payment date', async (_label, override) => {
    expect(
      await previewEnrollFamily(scope, { ...input, payment: { ...input.payment, ...override } })
    ).toBe('validationError')
  })

  it.each(['02/04/2018', '2018-04-02T00:00:00+02:00'])(
    'refuses %s as a birthday, which is a calendar day',
    async (birthday) => {
      expect(
        await previewEnrollFamily(scope, {
          ...input,
          students: [{ ...input.students[0], birthday }],
        })
      ).toBe('validationError')
    }
  )

  it('rejects malformed input before reading anything', async () => {
    expect(await previewEnrollFamily(scope, { ...input, students: [] })).toBe('validationError')
    expect(listClassPeriods).not.toHaveBeenCalled()
  })
})
