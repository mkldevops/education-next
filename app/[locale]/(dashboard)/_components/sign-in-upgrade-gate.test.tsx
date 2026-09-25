import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { user: { findUnique: vi.fn() } }
const authMock = { api: { getSession: vi.fn() } }
const isGoogleSignInAvailableMock = vi.fn()
const isPasskeySignInEnabledMock = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/platform-settings/is-google-sign-in-available', () => ({
  isGoogleSignInAvailable: () => isGoogleSignInAvailableMock(),
}))
vi.mock('@/use-cases/platform-settings/is-passkey-sign-in-enabled', () => ({
  isPasskeySignInEnabled: () => isPasskeySignInEnabledMock(),
}))
// Le dialogue est un composant client : seul le contrat de props du gate est en jeu ici.
vi.mock('@/features/auth', () => ({ SignInUpgradeDialog: () => null }))

const { SignInUpgradeGate } = await import('./sign-in-upgrade-gate')

const session = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1', email: 'parent@gmail.com' },
  session: { id: 'session-1', ...overrides },
})

const account = (overrides: Record<string, unknown> = {}) => ({
  signInUpgradeDismissedAt: null,
  accounts: [],
  _count: { passkeys: 0 },
  ...overrides,
})

const propsOf = async () => {
  const element = await SignInUpgradeGate()
  return element ? (element.props as { offer: unknown; googleLinked: boolean }) : null
}

describe('SignInUpgradeGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.api.getSession.mockResolvedValue(session())
    dbMock.user.findUnique.mockResolvedValue(account())
    isGoogleSignInAvailableMock.mockResolvedValue(true)
    isPasskeySignInEnabledMock.mockResolvedValue(true)
  })

  it('renders nothing without a session and never reads the account', async () => {
    authMock.api.getSession.mockResolvedValue(null)

    expect(await SignInUpgradeGate()).toBeNull()
    expect(dbMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('stays silent during impersonation, before any account read', async () => {
    authMock.api.getSession.mockResolvedValue(session({ impersonatedBy: 'admin-1' }))

    expect(await SignInUpgradeGate()).toBeNull()
    expect(dbMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('reads the account once, scoped to the session user', async () => {
    await SignInUpgradeGate()

    expect(dbMock.user.findUnique).toHaveBeenCalledTimes(1)
    expect(dbMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
  })

  it('offers Google and a passkey to a Gmail user with neither', async () => {
    expect(await propsOf()).toEqual({ offer: { google: true, passkey: true }, googleLinked: false })
  })

  it('offers only a passkey outside Gmail', async () => {
    authMock.api.getSession.mockResolvedValue({
      ...session(),
      user: { id: 'user-1', email: 'parent@school.test' },
    })

    expect(await propsOf()).toEqual({
      offer: { google: false, passkey: true },
      googleLinked: false,
    })
  })

  it('offers nothing once dismissed', async () => {
    dbMock.user.findUnique.mockResolvedValue(account({ signInUpgradeDismissedAt: new Date() }))

    expect(await propsOf()).toEqual({ offer: null, googleLinked: false })
  })

  it('offers nothing once Google is linked, and lets the dialog confirm the link', async () => {
    dbMock.user.findUnique.mockResolvedValue(account({ accounts: [{ id: 'account-1' }] }))

    expect(await propsOf()).toEqual({ offer: null, googleLinked: true })
  })

  it('offers nothing once a passkey exists', async () => {
    dbMock.user.findUnique.mockResolvedValue(account({ _count: { passkeys: 1 } }))

    expect(await propsOf()).toEqual({ offer: null, googleLinked: false })
  })
})
