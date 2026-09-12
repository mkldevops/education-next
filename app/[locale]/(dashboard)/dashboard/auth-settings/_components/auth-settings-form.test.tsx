import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../../_lib/platform-settings-actions', () => ({
  setGoogleSignInEnabledAction: vi.fn(),
  setPasskeySignInEnabledAction: vi.fn(),
}))

import { AuthSettingsForm } from './auth-settings-form'

const baseProps = {
  googleEnabled: true,
  googleConfigured: true,
  passkeyEnabled: true,
  googleOnlyAccountCount: 0,
}

describe('AuthSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Google with no confirmation when no account is Google-only', () => {
    render(<AuthSettingsForm {...baseProps} googleOnlyAccountCount={0} />)

    const [googleCheckbox] = screen.getAllByRole('checkbox')
    fireEvent.click(googleCheckbox)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires confirmation naming the recovery path, with the count, before disabling Google', () => {
    render(<AuthSettingsForm {...baseProps} googleOnlyAccountCount={2} />)

    const [googleCheckbox] = screen.getAllByRole('checkbox')
    fireEvent.click(googleCheckbox)

    expect(screen.getByText('google.confirmDisable.description:{"count":2}')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'google.confirmDisable.confirm' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'google.confirmDisable.cancel' })).toBeInTheDocument()
  })

  it('never requires confirmation for the passkey toggle, regardless of the Google count', () => {
    render(<AuthSettingsForm {...baseProps} googleOnlyAccountCount={5} />)

    const [, passkeyCheckbox] = screen.getAllByRole('checkbox')
    fireEvent.click(passkeyCheckbox)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
