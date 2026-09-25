import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const isAiAssistantEnabledMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const previewEnrollFamilyMock = vi.fn()
const commitEnrollFamilyMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('./auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('@/use-cases/platform-settings/is-ai-assistant-enabled', () => ({
  isAiAssistantEnabled: isAiAssistantEnabledMock,
}))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/use-cases/mcp/preview-enroll-family', () => ({
  previewEnrollFamily: previewEnrollFamilyMock,
}))
vi.mock('@/use-cases/mcp/commit-enroll-family', () => ({
  commitEnrollFamily: commitEnrollFamilyMock,
}))

const { confirmAssistantEnrollmentAction, previewAssistantEnrollmentAction } = await import(
  './enroll-assistant-actions'
)

const expectedScope = {
  schoolId: 'school-1',
  userId: 'user-1',
  paymentsEnabled: true,
  owner: { kind: 'ADMIN_SESSION', userId: 'user-1' },
}

const validInput = {
  familyName: 'Durand',
  parents: [{ name: 'Alice', lastname: 'Durand' }],
  students: [{ name: 'Léo', lastname: 'Durand', className: 'CE1' }],
  planName: 'Annuel',
}

const draftId = '00000000-0000-4000-8000-000000000001'
const checksum = 'abcdef012345'

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isSuperAdmin: false,
  })
  isAiAssistantEnabledMock.mockResolvedValue(true)
  isPaymentsEnabledMock.mockResolvedValue(true)
  previewEnrollFamilyMock.mockResolvedValue({
    draftId,
    checksum,
    plan: {
      tool: 'enroll_family',
      family: { name: 'Durand', createdById: 'user-1' },
      parents: [{ name: 'Alice', lastname: 'Durand' }],
      students: [
        {
          name: 'Léo',
          lastname: 'Durand',
          classPeriod: { id: 'class-1', name: 'CE1' },
          plan: { id: 'plan-1', name: 'Annuel', amount: 300 },
          totalAmount: 300,
        },
      ],
      discount: 0,
      payment: { amount: 100, method: 'CASH', paidAt: '2026-09-01T00:00:00.000Z', allocation: [] },
    },
    matches: { families: [], students: [] },
    warnings: [],
    blockers: [],
  })
  commitEnrollFamilyMock.mockResolvedValue({
    familyId: 'family-1',
    parentIds: ['parent-1'],
    personIds: ['person-1'],
    studentIds: ['student-1'],
    enrollmentIds: ['enrollment-1'],
    paymentIds: [],
  })
})

describe('previewAssistantEnrollmentAction', () => {
  it('opens on the school admin guard before anything else', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(previewAssistantEnrollmentAction(validInput)).rejects.toThrow('notFound')
    expect(isAiAssistantEnabledMock).not.toHaveBeenCalled()
    expect(previewEnrollFamilyMock).not.toHaveBeenCalled()
  })

  it('refuses while the assistant is disabled, even for a valid input', async () => {
    isAiAssistantEnabledMock.mockResolvedValue(false)

    expect(await previewAssistantEnrollmentAction(validInput)).toEqual({
      status: 'aiAssistantDisabled',
    })
    expect(previewEnrollFamilyMock).not.toHaveBeenCalled()
  })

  it('names the invalid fields instead of leaking the raw issues', async () => {
    const result = await previewAssistantEnrollmentAction({
      familyName: 'Durand',
      students: [{ name: 'Léo', lastname: 'Durand', className: 'CE1', birthday: '31/12/2018' }],
      payment: { amount: 0, method: 'CASH', paidAt: '2026-09-01' },
    })

    expect(result.status).toBe('validationError')
    if (result.status !== 'validationError') return
    expect(result.fields).toContain('students.0.birthday')
    expect(result.fields).toContain('payment.amount')
    expect(previewEnrollFamilyMock).not.toHaveBeenCalled()
  })

  it('previews under an ADMIN_SESSION owner on the active school', async () => {
    const result = await previewAssistantEnrollmentAction(validInput)

    expect(previewEnrollFamilyMock).toHaveBeenCalledWith(
      expectedScope,
      expect.objectContaining({
        familyName: 'Durand',
      })
    )
    expect(result).toEqual({
      status: 'preview',
      draftId,
      checksum,
      plan: {
        family: { existing: false, name: 'Durand' },
        parentCount: 1,
        students: [
          { name: 'Léo', lastname: 'Durand', className: 'CE1', planName: 'Annuel', amount: 300 },
        ],
        payment: { amount: 100, method: 'CASH' },
      },
      matches: { families: [], students: [] },
      warnings: [],
      blockers: [],
    })
  })

  it('shows an attached family as existing without leaking its identifiers', async () => {
    previewEnrollFamilyMock.mockResolvedValue({
      draftId,
      checksum,
      plan: {
        tool: 'enroll_family',
        family: { id: 'family-9', name: 'Martin' },
        parents: [],
        students: [],
        discount: 0,
        payment: null,
      },
      matches: { families: [], students: [] },
      warnings: [],
      blockers: [],
    })

    const result = await previewAssistantEnrollmentAction({ ...validInput, familyId: undefined })

    expect(result.status).toBe('preview')
    if (result.status !== 'preview') return
    expect(result.plan.family).toEqual({ existing: true, name: 'Martin' })
    expect(result.plan.payment).toBeNull()
    expect(JSON.stringify(result)).not.toContain('family-9')
  })

  it('reports a blocked preview without a draft', async () => {
    previewEnrollFamilyMock.mockResolvedValue({
      draftId: null,
      checksum: null,
      plan: null,
      matches: { families: [], students: [] },
      warnings: [],
      blockers: [{ field: 'students.0.className', value: 'CE9', reason: 'unknownClass' }],
    })

    expect(await previewAssistantEnrollmentAction(validInput)).toEqual({
      status: 'blocked',
      matches: { families: [], students: [] },
      warnings: [],
      blockers: [{ field: 'students.0.className', value: 'CE9', reason: 'unknownClass' }],
    })
  })

  it('resolves the payments flag of the school for the scope', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    await previewAssistantEnrollmentAction({ ...validInput, planName: undefined })

    expect(previewEnrollFamilyMock.mock.calls[0][0]).toMatchObject({ paymentsEnabled: false })
  })
})

describe('confirmAssistantEnrollmentAction', () => {
  it('refuses while the assistant is disabled, even for a draft prepared before', async () => {
    isAiAssistantEnabledMock.mockResolvedValue(false)

    expect(await confirmAssistantEnrollmentAction({ draftId, checksum })).toEqual({
      status: 'aiAssistantDisabled',
    })
    expect(commitEnrollFamilyMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed reference before touching the draft', async () => {
    expect(await confirmAssistantEnrollmentAction({ draftId: 'x', checksum })).toEqual({
      status: 'validationError',
    })
    expect(commitEnrollFamilyMock).not.toHaveBeenCalled()
  })

  it('commits with the session owner and replays the affected pages', async () => {
    const result = await confirmAssistantEnrollmentAction({ draftId, checksum })

    expect(commitEnrollFamilyMock).toHaveBeenCalledWith(expectedScope, { draftId, checksum })
    expect(result).toEqual({
      status: 'committed',
      familyId: 'family-1',
      studentIds: ['student-1'],
      enrollmentIds: ['enrollment-1'],
      paymentIds: [],
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/enrollments')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/families', 'layout')
    expect(revalidatePathMock).not.toHaveBeenCalledWith('/dashboard/payments')
  })

  it('replays the payments page only when a payment was written', async () => {
    commitEnrollFamilyMock.mockResolvedValue({
      familyId: 'family-1',
      parentIds: [],
      personIds: [],
      studentIds: ['student-1'],
      enrollmentIds: ['enrollment-1'],
      paymentIds: ['payment-1'],
    })

    await confirmAssistantEnrollmentAction({ draftId, checksum })

    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/payments')
  })

  it('surfaces every business refusal as a typed reason without revalidating', async () => {
    for (const reason of [
      'draftNotFound',
      'draftExpired',
      'checksumMismatch',
      'commitInProgress',
      'staleDraft',
      'classFull',
      'duplicateEnrollment',
    ]) {
      commitEnrollFamilyMock.mockResolvedValue(reason)

      expect(await confirmAssistantEnrollmentAction({ draftId, checksum })).toEqual({
        status: 'refused',
        reason,
      })
    }
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('never exposes parent or person ids to the browser', async () => {
    const result = await confirmAssistantEnrollmentAction({ draftId, checksum })

    expect(result).not.toHaveProperty('parentIds')
    expect(result).not.toHaveProperty('personIds')
  })
})
