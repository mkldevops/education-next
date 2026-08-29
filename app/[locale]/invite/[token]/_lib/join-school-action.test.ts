import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const findInvitationByTokenMock = vi.fn()
const transactionMock = vi.fn()
const linkInvitedUserMock = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { $transaction: transactionMock } }))
vi.mock('@/lib/db-unscoped', () => ({ findInvitationByToken: findInvitationByTokenMock }))
vi.mock('./link-invited-user', () => ({ linkInvitedUser: linkInvitedUserMock }))

const { joinSchoolAction } = await import('./join-school-action')

const TOKEN = 'token-1'
const INVITATION = {
  id: 'invitation-1',
  schoolId: 'school-b',
  email: 'Parent@School.test',
  role: 'PARENT',
  familyId: null,
  usedAt: null,
  expiresAt: new Date('2099-01-01'),
}

const signedInAs = (email: string | null, id = 'user-1') =>
  getSessionMock.mockResolvedValue(email ? { user: { id, email } } : null)

beforeEach(() => {
  vi.clearAllMocks()
  findInvitationByTokenMock.mockResolvedValue(INVITATION)
  linkInvitedUserMock.mockResolvedValue('OK')
  transactionMock.mockImplementation((fn: (tx: unknown) => unknown) => fn({}))
})

describe('joinSchoolAction', () => {
  it('refuses an anonymous caller holding a valid token', async () => {
    signedInAs(null)

    expect(await joinSchoolAction({ token: TOKEN })).toBe('unauthenticated')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('refuses a session whose email is not the invited one', async () => {
    signedInAs('someone.else@school.test')

    expect(await joinSchoolAction({ token: TOKEN })).toBe('emailMismatch')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('accepts the invited address regardless of case', async () => {
    signedInAs('parent@school.test')

    expect(await joinSchoolAction({ token: TOKEN })).toBe('OK')
    expect(linkInvitedUserMock).toHaveBeenCalledWith(expect.anything(), INVITATION, 'user-1')
  })

  it('refuses an unknown token', async () => {
    signedInAs('parent@school.test')
    findInvitationByTokenMock.mockResolvedValue(null)

    expect(await joinSchoolAction({ token: TOKEN })).toBe('invalid')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('refuses a token already consumed', async () => {
    signedInAs('parent@school.test')
    findInvitationByTokenMock.mockResolvedValue({ ...INVITATION, usedAt: new Date() })

    expect(await joinSchoolAction({ token: TOKEN })).toBe('alreadyUsed')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('refuses an expired token', async () => {
    signedInAs('parent@school.test')
    findInvitationByTokenMock.mockResolvedValue({
      ...INVITATION,
      expiresAt: new Date('2000-01-01'),
    })

    expect(await joinSchoolAction({ token: TOKEN })).toBe('expired')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('reports an existing membership instead of duplicating it', async () => {
    signedInAs('parent@school.test')
    linkInvitedUserMock.mockResolvedValue('alreadyMember')

    expect(await joinSchoolAction({ token: TOKEN })).toBe('alreadyMember')
  })

  it('never creates an account on this path', async () => {
    signedInAs('parent@school.test')

    await joinSchoolAction({ token: TOKEN })

    expect(linkInvitedUserMock).toHaveBeenCalledTimes(1)
  })
})
