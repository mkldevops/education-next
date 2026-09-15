import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const signUpEmailMock = vi.fn()
const createMembershipMock = vi.fn()
const sendVerificationEmailMock = vi.fn()
const findManagedMock = vi.fn()
const findByEmailMock = vi.fn()
const updateMock = vi.fn()

const dbMock = {
  user: { update: vi.fn() },
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: dbMock, dbArchived: dbMock }))
vi.mock('@/lib/db-unscoped', () => ({ countRowsBlockingUserDeletion: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { signUpEmail: signUpEmailMock, sendVerificationEmail: sendVerificationEmailMock } },
}))
vi.mock('@/gateways/user-gateway', () => ({
  userGateway: { findManaged: findManagedMock, findByEmail: findByEmailMock, update: updateMock },
}))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { createMembership: createMembershipMock },
}))
vi.mock('./auth-helper', () => ({
  requireSchoolAdmin: requireSchoolAdminMock,
  requirePlatformAdmin: vi.fn(),
}))

const { createUserAction, updateUserAction } = await import('./user-actions')

const INPUT = { name: 'Karim Benali', password: 'password123', role: 'PARENT' as const }

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  signUpEmailMock.mockResolvedValue({ user: { id: 'user-2' } })
  dbMock.user.update.mockResolvedValue({ id: 'user-2' })
  createMembershipMock.mockResolvedValue({ userId: 'user-2', schoolId: 'school-b' })
  sendVerificationEmailMock.mockResolvedValue({ status: true })
  findManagedMock.mockResolvedValue({ id: 'user-2', email: 'old@school.test' })
  findByEmailMock.mockResolvedValue(null)
  // `userGateway.update` rend la ligne Prisma mise à jour, jamais `'OK'` : un
  // mock qui renverrait une chaîne ferait passer le garde d'échec pour un succès.
  updateMock.mockImplementation(async (id: string, data: Record<string, unknown>) => ({
    id,
    email: 'new@school.test',
    emailVerified: false,
    ...data,
  }))
})

describe('createUserAction', () => {
  it('creates the account with the address in lower case', async () => {
    const result = await createUserAction({ ...INPUT, email: 'Karim.Benali@School.TEST' })

    expect(signUpEmailMock).toHaveBeenCalledWith({
      body: { name: INPUT.name, email: 'karim.benali@school.test', password: INPUT.password },
    })
    expect(result).toEqual({ id: 'user-2', email: 'karim.benali@school.test' })
  })

  it('rejects an invalid address before creating anything', async () => {
    expect(await createUserAction({ ...INPUT, email: 'nope' })).toBe('validation_error')
    expect(signUpEmailMock).not.toHaveBeenCalled()
  })
})

describe('updateUserAction on an address rewritten by an administrator', () => {
  const EDIT = { id: 'user-2', name: 'Karim', emailVerified: true }

  it('mails the new address and drops the verified flag the form resubmitted', async () => {
    expect(await updateUserAction({ ...EDIT, email: 'new@school.test' })).toBe('OK')

    expect(updateMock).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ email: 'new@school.test', emailVerified: false })
    )
    expect(sendVerificationEmailMock).toHaveBeenCalledWith({
      body: { email: 'new@school.test' },
    })
  })

  it('leaves an unchanged address alone, whatever its case', async () => {
    expect(await updateUserAction({ ...EDIT, email: 'Old@School.TEST' })).toBe('OK')

    expect(sendVerificationEmailMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ emailVerified: true })
    )
  })

  it('still reports OK when the verification mail cannot be sent', async () => {
    sendVerificationEmailMock.mockRejectedValue(new Error('EMAIL_FROM missing'))

    expect(await updateUserAction({ ...EDIT, email: 'new@school.test' })).toBe('OK')
  })
})
