import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/i18n/routing', () => ({
  useRouter: () => i18nRouter,
}))

vi.mock('@/actions', () => ({
  deleteProfileAction: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  signOut: () => signOut(),
  linkSocial: vi.fn(),
  unlinkAccount: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  toast: { error: (message: string) => toastError(message) },
}))

import { AccountSection } from './account-section'

const i18nRouter = { push: vi.fn() }
const signOut = vi.fn(async () => ({ error: null }))
const toastError = vi.fn()

const logout = () => {
  render(<AccountSection email="parent@school.test" linkedAccounts={[]} />)
  fireEvent.click(screen.getByRole('button', { name: 'logout.button' }))
  fireEvent.click(screen.getByRole('button', { name: 'logout.confirm' }))
}

describe('AccountSection sign out', () => {
  beforeEach(() => {
    i18nRouter.push.mockClear()
    signOut.mockClear()
    toastError.mockClear()
    signOut.mockResolvedValue({ error: null })
  })

  it('sends the user home once the session is closed', async () => {
    logout()

    await waitFor(() => expect(i18nRouter.push).toHaveBeenCalledWith('/'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('keeps the user in place and reports a failed sign out', async () => {
    signOut.mockResolvedValue({ error: { message: 'network' } } as never)

    logout()

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.logoutFailed'))
    expect(i18nRouter.push).not.toHaveBeenCalled()
  })
})
