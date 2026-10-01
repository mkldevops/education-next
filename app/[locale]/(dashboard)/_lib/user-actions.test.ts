import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const createCredentialUserMock = vi.fn()
const createWithoutPasswordMock = vi.fn()
const createMembershipMock = vi.fn()
const sendVerificationEmailMock = vi.fn()
const requestPasswordResetMock = vi.fn()
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
  auth: {
    api: {
      sendVerificationEmail: sendVerificationEmailMock,
      requestPasswordReset: requestPasswordResetMock,
    },
  },
}))
vi.mock('@/gateways/credential-user-gateway', () => ({
  credentialUserGateway: {
    create: createCredentialUserMock,
    createWithoutPassword: createWithoutPasswordMock,
  },
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

const INPUT = { name: 'Karim Benali', role: 'PARENT' as const }

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  createWithoutPasswordMock.mockResolvedValue({ id: 'user-2' })
  dbMock.user.update.mockResolvedValue({ id: 'user-2' })
  createMembershipMock.mockResolvedValue({ userId: 'user-2', schoolId: 'school-b' })
  sendVerificationEmailMock.mockResolvedValue({ status: true })
  requestPasswordResetMock.mockResolvedValue({ status: true })
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
  it('creates the account without a password, then mails the set-password link', async () => {
    const result = await createUserAction({ ...INPUT, email: 'Karim.Benali@School.TEST' })

    expect(createWithoutPasswordMock).toHaveBeenCalledWith({
      name: INPUT.name,
      email: 'karim.benali@school.test',
    })
    expect(createMembershipMock).toHaveBeenCalledWith('user-2', 'school-b', 'PARENT')
    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      body: { email: 'karim.benali@school.test', redirectTo: '/reset-password' },
    })
    expect(result).toEqual({ id: 'user-2', email: 'karim.benali@school.test' })
  })

  it('regression: a password supplied by the administrator is never written', async () => {
    // Une Server Action est un endpoint HTTP : le client peut envoyer n'importe
    // quel champ. Un mot de passe choisi par l'admin de A lui ouvrirait ce compte
    // dans toute école B qui inviterait ensuite cette adresse.
    const smuggled = { ...INPUT, email: 'directrice@ecole-b.fr', password: 'connu-de-l-admin' }

    const result = await createUserAction(smuggled as typeof INPUT & { email: string })

    expect(result).toEqual({ id: 'user-2', email: 'directrice@ecole-b.fr' })
    expect(createCredentialUserMock).not.toHaveBeenCalled()
    expect(createWithoutPasswordMock).toHaveBeenCalledWith({
      name: INPUT.name,
      email: 'directrice@ecole-b.fr',
    })
    expect(createWithoutPasswordMock.mock.calls[0]?.[0]).not.toHaveProperty('password')
  })

  it('rejects an invalid address before creating anything', async () => {
    expect(await createUserAction({ ...INPUT, email: 'nope' })).toBe('validation_error')
    expect(createWithoutPasswordMock).not.toHaveBeenCalled()
    expect(requestPasswordResetMock).not.toHaveBeenCalled()
  })

  it('reports emailError when the link cannot be sent, keeping the created account', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('EMAIL_FROM missing'))

    expect(await createUserAction({ ...INPUT, email: 'karim@school.test' })).toBe('emailError')
    expect(createWithoutPasswordMock).toHaveBeenCalledTimes(1)
    expect(createMembershipMock).toHaveBeenCalledTimes(1)
  })

  it('sends no link when the account could not be created', async () => {
    createWithoutPasswordMock.mockRejectedValue(new Error('Email already used'))

    expect(await createUserAction({ ...INPUT, email: 'karim@school.test' })).toBe('error')
    expect(createMembershipMock).not.toHaveBeenCalled()
    expect(requestPasswordResetMock).not.toHaveBeenCalled()
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
