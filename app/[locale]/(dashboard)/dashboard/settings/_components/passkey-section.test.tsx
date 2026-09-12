import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

import { PasskeySection } from './passkey-section'

const deletePasskey = vi.fn(async (_passkeyId: string) => 'OK' as const)
const getUserPasskeys = vi.fn(async () => [] as Passkey[])

type Passkey = {
  id: string
  name: string
  deviceType: string
  createdAt: Date
}

const macBook: Passkey = {
  id: 'pk_1',
  name: 'MacBook Touch ID',
  deviceType: 'singleDevice',
  createdAt: new Date('2026-01-15T10:00:00Z'),
}

describe('PasskeySection with passkey sign-in disabled', () => {
  beforeEach(() => {
    deletePasskey.mockClear()
    getUserPasskeys.mockReset()
    getUserPasskeys.mockResolvedValue([])
  })

  it('keeps the existing passkeys listed and removable', async () => {
    getUserPasskeys.mockResolvedValue([macBook])

    render(<PasskeySection enabled={false} />)

    expect(await screen.findByText('MacBook Touch ID')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(deletePasskey).toHaveBeenCalledWith('pk_1'))
  })

  it('drops the registration form and explains why', async () => {
    getUserPasskeys.mockResolvedValue([macBook])

    render(<PasskeySection enabled={false} />)

    // La liste rendue signe la fin de la transition de chargement : sans elle le bouton
    // « Ajouter » s'appellerait encore `...` et son absence ne prouverait rien.
    expect(await screen.findByText('MacBook Touch ID')).toBeInTheDocument()
    expect(screen.getByText('registrationDisabled')).toBeInTheDocument()
    expect(screen.queryByLabelText('namePlaceholder')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'register' })).not.toBeInTheDocument()
  })

  it('renders nothing when the user owns no passkey', async () => {
    render(<PasskeySection enabled={false} />)

    await waitFor(() => expect(getUserPasskeys).toHaveBeenCalled())
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })
})

describe('PasskeySection with passkey sign-in enabled', () => {
  beforeEach(() => {
    deletePasskey.mockClear()
    getUserPasskeys.mockReset()
    getUserPasskeys.mockResolvedValue([])
  })

  it('offers the registration form even without any passkey', async () => {
    render(<PasskeySection enabled={true} />)

    expect(await screen.findByText('title')).toBeInTheDocument()
    expect(screen.getByLabelText('namePlaceholder')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'register' })).toBeInTheDocument()
    expect(screen.queryByText('registrationDisabled')).not.toBeInTheDocument()
  })
})
