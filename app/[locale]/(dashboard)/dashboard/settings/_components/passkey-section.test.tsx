import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Le baril `@peaklab/ui` (Breadcrumbs) importe `Link` depuis `@/i18n/routing`, qui
// appelle `next-intl/navigation` — non résoluble par Node hors du bundler Next. Rien
// ici ne dépend de la navigation localisée elle-même.
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
}))

vi.mock('@/actions', () => ({
  deletePasskey: (id: string) => deletePasskey(id),
  getPasskeyRegistrationOptions: vi.fn(),
  getUserPasskeys: () => getUserPasskeys(),
  verifyPasskeyRegistration: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: (message: string) => toastSuccess(message) },
}))

import { type Passkey, PasskeySection } from './passkey-section'

const deletePasskey = vi.fn(async (_passkeyId: string) => 'OK' as const)
const getUserPasskeys = vi.fn(async () => [] as Passkey[])
const toastSuccess = vi.fn()

const macBook: Passkey = {
  id: 'pk_1',
  name: 'MacBook Touch ID',
  deviceType: 'singleDevice',
  createdAt: new Date('2026-01-15T10:00:00Z'),
}

beforeEach(() => {
  deletePasskey.mockClear()
  toastSuccess.mockClear()
  getUserPasskeys.mockReset()
  getUserPasskeys.mockResolvedValue([])
})

describe('PasskeySection with passkey sign-in disabled', () => {
  it('keeps the existing passkeys listed and removable', async () => {
    getUserPasskeys.mockResolvedValue([macBook])

    render(<PasskeySection enabled={false} initialPasskeys={[macBook]} />)

    expect(screen.getByText('MacBook Touch ID')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(deletePasskey).toHaveBeenCalledWith('pk_1'))
  })

  it('drops the registration form and explains why', () => {
    render(<PasskeySection enabled={false} initialPasskeys={[macBook]} />)

    expect(screen.getByText('registrationDisabled')).toBeInTheDocument()
    expect(screen.getByText('descriptionDisabled')).toBeInTheDocument()
    expect(screen.queryByText('description')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('namePlaceholder')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'register' })).not.toBeInTheDocument()
  })

  it('renders nothing when the user owns no passkey', () => {
    render(<PasskeySection enabled={false} initialPasskeys={[]} />)

    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })

  it('withdraws the card once the last passkey is deleted, and still confirms it', async () => {
    render(<PasskeySection enabled={false} initialPasskeys={[macBook]} />)

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))

    // Le bandeau de succès disparaîtrait avec la carte : la confirmation passe par une
    // notification, seule à survivre au démontage.
    await waitForElementToBeRemoved(() => screen.queryByText('title'))
    expect(toastSuccess).toHaveBeenCalledWith('deleted')
  })
})

describe('PasskeySection with passkey sign-in enabled', () => {
  it('offers the registration form even without any passkey', () => {
    render(<PasskeySection enabled={true} initialPasskeys={[]} />)

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('description')).toBeInTheDocument()
    expect(screen.getByLabelText('namePlaceholder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'register' })).toBeInTheDocument()
    expect(screen.queryByText('registrationDisabled')).not.toBeInTheDocument()
  })
})
