import { beforeEach, describe, expect, it, vi } from 'vitest'

const findInvitationByTokenMock = vi.fn()
const signUpEmailMock = vi.fn()
const linkInvitedUserMock = vi.fn()

const dbMock = {
  user: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/db-unscoped', () => ({ findInvitationByToken: findInvitationByTokenMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { signUpEmail: signUpEmailMock } } }))
vi.mock('./link-invited-user', () => ({ linkInvitedUser: linkInvitedUserMock }))

const { acceptInvitationAction } = await import('./accept-invitation-action')

const INPUT = { token: 'token-1', name: 'Karim Benali', password: 'password123' }

const invitation = (email: string) => ({
  id: 'invitation-1',
  email,
  schoolId: 'school-b',
  role: 'PARENT' as const,
  familyId: null,
  usedAt: null,
  expiresAt: new Date(Date.now() + 3_600_000),
})

beforeEach(() => {
  vi.clearAllMocks()
  findInvitationByTokenMock.mockResolvedValue(invitation('parent@school.test'))
  // Better Auth n'écrit que des adresses en minuscules.
  dbMock.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) =>
    where.email === 'parent@school.test' ? { id: 'user-1' } : null
  )
  dbMock.user.delete.mockResolvedValue({ id: 'user-2' })
  signUpEmailMock.mockResolvedValue({ user: { id: 'user-2' } })
  linkInvitedUserMock.mockResolvedValue('OK')
  dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock))
})

describe('acceptInvitationAction', () => {
  it('refuses to create a second account for an address already taken', async () => {
    expect(await acceptInvitationAction(INPUT)).toBe('emailAlreadyUsed')
    expect(signUpEmailMock).not.toHaveBeenCalled()
  })

  it('refuses just the same when the invitation carries a mixed-case address', async () => {
    findInvitationByTokenMock.mockResolvedValue(invitation('Parent@School.TEST'))

    expect(await acceptInvitationAction(INPUT)).toBe('emailAlreadyUsed')
    expect(signUpEmailMock).not.toHaveBeenCalled()
  })

  it('creates the account of an address nobody holds', async () => {
    findInvitationByTokenMock.mockResolvedValue(invitation('newcomer@school.test'))

    expect(await acceptInvitationAction(INPUT)).toBe('OK')
    expect(linkInvitedUserMock).toHaveBeenCalledWith(dbMock, expect.anything(), 'user-2')
  })

  it('deletes the account it just created when the link is refused', async () => {
    findInvitationByTokenMock.mockResolvedValue(invitation('newcomer@school.test'))
    linkInvitedUserMock.mockResolvedValue('alreadyUsed')

    expect(await acceptInvitationAction(INPUT)).toBe('alreadyUsed')
    expect(dbMock.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } })
  })

  it('refuses an expired invitation before touching any account', async () => {
    findInvitationByTokenMock.mockResolvedValue({
      ...invitation('newcomer@school.test'),
      expiresAt: new Date(Date.now() - 1_000),
    })

    expect(await acceptInvitationAction(INPUT)).toBe('expired')
    expect(signUpEmailMock).not.toHaveBeenCalled()
  })
})
