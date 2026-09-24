import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const changePasswordMock = vi.fn()
const changeEmailMock = vi.fn()
const revokeSessionMock = vi.fn()
const deleteProfileMock = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/platform-email', () => ({ sendPlatformEmail: vi.fn() }))
vi.mock('@/gateways/prisma-profile-gateway', () => ({ PrismaProfileGateway: class {} }))
vi.mock('@/use-cases/commands/delete-profile', () => ({ deleteProfile: deleteProfileMock }))
vi.mock('@/use-cases/commands/update-profile', () => ({ updateProfile: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
      changePassword: changePasswordMock,
      changeEmail: changeEmailMock,
      revokeSession: revokeSessionMock,
    },
  },
}))

const { changeEmailAction, changePasswordAction, deleteProfileAction, revokeSessionAction } =
  await import('./profile-actions')

const ownSession = {
  user: { id: 'user-1', email: 'parent@school.test' },
  session: { impersonatedBy: null },
}
const borrowedSession = {
  user: { id: 'user-1', email: 'parent@school.test' },
  session: { impersonatedBy: 'super-admin-1' },
}
const impersonating = { success: false, error: 'impersonating' }

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue(ownSession)
  deleteProfileMock.mockResolvedValue('OK')
})

describe('credential operations while impersonating', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(borrowedSession)
  })

  it('refuses the account deletion before the use case runs', async () => {
    expect(await deleteProfileAction()).toEqual(impersonating)
    expect(deleteProfileMock).not.toHaveBeenCalled()
  })

  it('refuses the password change before Better Auth is called', async () => {
    const result = await changePasswordAction({
      currentPassword: 'current-pass',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    })

    expect(result).toEqual(impersonating)
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('refuses the email change before Better Auth is called', async () => {
    expect(await changeEmailAction({ newEmail: 'attacker@evil.test' })).toEqual(impersonating)
    expect(changeEmailMock).not.toHaveBeenCalled()
  })

  it('refuses a session revocation before Better Auth is called', async () => {
    expect(await revokeSessionAction('token-1')).toEqual(impersonating)
    expect(revokeSessionMock).not.toHaveBeenCalled()
  })
})

describe('credential operations on an ordinary session', () => {
  it('deletes the authenticated account', async () => {
    expect(await deleteProfileAction()).toEqual({ success: true, data: null })
    expect(deleteProfileMock).toHaveBeenCalledWith('user-1', expect.anything())
  })

  it('forwards the email change to Better Auth', async () => {
    changeEmailMock.mockResolvedValue({ status: true })

    expect(await changeEmailAction({ newEmail: 'New@School.test' })).toEqual({
      success: true,
      data: null,
    })
    expect(changeEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ newEmail: 'new@school.test' }) })
    )
  })

  it('answers unauthorized without a session', async () => {
    getSessionMock.mockResolvedValue(null)

    expect(await deleteProfileAction()).toEqual({ success: false, error: 'unauthorized' })
    expect(await revokeSessionAction('token-1')).toEqual({ success: false, error: 'unauthorized' })
    expect(deleteProfileMock).not.toHaveBeenCalled()
    expect(revokeSessionMock).not.toHaveBeenCalled()
  })
})
