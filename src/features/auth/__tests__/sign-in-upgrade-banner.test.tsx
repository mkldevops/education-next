import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dismissSignInUpgradeAction = vi.fn()
const getPasskeyRegistrationOptions = vi.fn()
const verifyPasskeyRegistration = vi.fn()
const linkSocial = vi.fn()
const browserSupportsWebAuthn = vi.fn()
const startRegistration = vi.fn()
const toastSuccess = vi.fn()
const refresh = vi.fn()
const replace = vi.fn()
const searchParams = new URLSearchParams()

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/fr/dashboard',
  useRouter: () => ({ refresh, replace }),
  useSearchParams: () => searchParams,
}))
// Le baril `@peaklab/ui` tire la navigation localisée, que Node ne résout pas hors
// du bundler Next. Rien ici n'en dépend.
vi.mock('@/i18n/routing', () => ({
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ refresh }),
}))
vi.mock('@/actions', () => ({
  dismissSignInUpgradeAction: () => dismissSignInUpgradeAction(),
  getPasskeyRegistrationOptions: (name: string) => getPasskeyRegistrationOptions(name),
  verifyPasskeyRegistration: (response: unknown, name: string) =>
    verifyPasskeyRegistration(response, name),
}))
vi.mock('@/lib/auth-client', () => ({ linkSocial: (input: unknown) => linkSocial(input) }))
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => browserSupportsWebAuthn(),
  startRegistration: (input: unknown) => startRegistration(input),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: (message: string) => toastSuccess(message) } }))

const { SignInUpgradeBanner } = await import('../sign-in-upgrade-banner')

const renderBanner = (offer: { google: boolean; passkey: boolean } | null, googleLinked = false) =>
  render(<SignInUpgradeBanner offer={offer} googleLinked={googleLinked} />)

const banner = () => screen.queryByRole('region', { name: 'title' })
const googleButton = () => screen.queryByRole('button', { name: 'continueWithGoogle' })
const passkeyButton = () => screen.queryByRole('button', { name: 'createPasskey' })
const laterButton = () => screen.getByRole('button', { name: 'later' })

describe('SignInUpgradeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParams.delete('signInUpgrade')
    browserSupportsWebAuthn.mockReturnValue(true)
    dismissSignInUpgradeAction.mockResolvedValue({ success: true, data: null })
    linkSocial.mockResolvedValue({ data: {}, error: null })
    getPasskeyRegistrationOptions.mockResolvedValue({ options: { rp: {} }, passkeyName: 'Mon' })
    startRegistration.mockResolvedValue({ id: 'credential-1' })
    verifyPasskeyRegistration.mockResolvedValue('OK')
  })

  it('offers both methods to a Gmail user without blocking the page', () => {
    renderBanner({ google: true, passkey: true })

    expect(banner()).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(googleButton()).toBeInTheDocument()
    expect(passkeyButton()).toBeInTheDocument()
    expect(screen.getByText('descriptionGoogle')).toBeInTheDocument()
  })

  it('offers only a passkey outside Gmail', () => {
    renderBanner({ google: false, passkey: true })

    expect(banner()).toBeInTheDocument()
    expect(googleButton()).not.toBeInTheDocument()
    expect(passkeyButton()).toBeInTheDocument()
    expect(screen.getByText('descriptionPasskey')).toBeInTheDocument()
  })

  it('hides the passkey without WebAuthn and keeps Google', () => {
    browserSupportsWebAuthn.mockReturnValue(false)
    renderBanner({ google: true, passkey: true })

    expect(banner()).toBeInTheDocument()
    expect(googleButton()).toBeInTheDocument()
    expect(passkeyButton()).not.toBeInTheDocument()
  })

  it('shows nothing and records nothing without WebAuthn outside Gmail', () => {
    browserSupportsWebAuthn.mockReturnValue(false)
    renderBanner({ google: false, passkey: true })

    expect(banner()).not.toBeInTheDocument()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
  })

  it('shows nothing without an offer', () => {
    renderBanner(null)

    expect(banner()).not.toBeInTheDocument()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
  })

  it('records "later" and hides the banner', async () => {
    renderBanner({ google: true, passkey: true })

    fireEvent.click(laterButton())

    await waitFor(() => expect(banner()).not.toBeInTheDocument())
    expect(dismissSignInUpgradeAction).toHaveBeenCalledTimes(1)
  })

  it('starts the Google link back to the dashboard', async () => {
    renderBanner({ google: true, passkey: true })

    fireEvent.click(googleButton() as HTMLElement)

    await waitFor(() =>
      expect(linkSocial).toHaveBeenCalledWith({
        provider: 'google',
        callbackURL: '/fr/dashboard?signInUpgrade=google',
        errorCallbackURL: '/fr/dashboard?signInUpgrade=google-error',
      })
    )
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
  })

  it('keeps the banner on a Google link failure', async () => {
    linkSocial.mockResolvedValue({ data: null, error: { code: 'boom' } })
    renderBanner({ google: true, passkey: true })

    fireEvent.click(googleButton() as HTMLElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.linkFailed')
    expect(banner()).toBeInTheDocument()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
  })

  it('registers a passkey, confirms and hides without recording a refusal', async () => {
    renderBanner({ google: false, passkey: true })

    fireEvent.click(passkeyButton() as HTMLElement)

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('passkeyRegistered'))
    expect(getPasskeyRegistrationOptions).toHaveBeenCalledWith('passkeyDefaultName')
    expect(verifyPasskeyRegistration).toHaveBeenCalledWith(
      { id: 'credential-1' },
      'passkeyDefaultName'
    )
    expect(banner()).not.toBeInTheDocument()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps the banner when the WebAuthn ceremony is cancelled', async () => {
    startRegistration.mockRejectedValue(new Error('NotAllowedError'))
    renderBanner({ google: false, passkey: true })

    fireEvent.click(passkeyButton() as HTMLElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.cancelled')
    expect(banner()).toBeInTheDocument()
    expect(verifyPasskeyRegistration).not.toHaveBeenCalled()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('surfaces a verification failure inline', async () => {
    verifyPasskeyRegistration.mockResolvedValue('verificationFailed')
    renderBanner({ google: false, passkey: true })

    fireEvent.click(passkeyButton() as HTMLElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.verificationFailed')
    expect(banner()).toBeInTheDocument()
    expect(dismissSignInUpgradeAction).not.toHaveBeenCalled()
  })

  it('confirms a Google link on return and strips the parameter', async () => {
    searchParams.set('signInUpgrade', 'google')
    renderBanner(null, true)

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('googleLinked'))
    expect(replace).toHaveBeenCalledWith('/fr/dashboard')
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows the Google error on return and keeps the offer', async () => {
    searchParams.set('signInUpgrade', 'google-error')
    renderBanner({ google: true, passkey: true })

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.linkFailed')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/fr/dashboard')
  })
})
