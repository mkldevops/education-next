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
  setMcpEnabledAction: vi.fn(),
  setAiAssistantEnabledAction: vi.fn(),
  setOpenRouterApiKeyAction: vi.fn(),
  deleteOpenRouterApiKeyAction: vi.fn(),
  setSchoolSwitchEnabledAction: vi.fn(),
}))

import { PlatformSettingsPanel } from './platform-settings-panel'

const baseProps = {
  googleEnabled: true,
  googleConfigured: true,
  passkeyEnabled: true,
  mcpEnabled: false,
  aiAssistantEnabled: false,
  openRouterKey: { status: 'notConfigured' as const, hint: null, savedAt: null },
  secretStorageConfigured: true,
  schoolSwitchEnabled: true,
  googleOnlyAccountCount: 0,
}

// Réglages rendus dans cet ordre par le panneau : Google, passkey (section « Sign-in
// methods »), bascule d'école (section « Schools »), MCP (section « Integrations »).
const [GOOGLE, PASSKEY] = [0, 1]

describe('PlatformSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Google with no confirmation when no account is Google-only', () => {
    render(<PlatformSettingsPanel {...baseProps} googleOnlyAccountCount={0} />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[GOOGLE])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires confirmation naming the recovery path, with the count, before disabling Google', () => {
    render(<PlatformSettingsPanel {...baseProps} googleOnlyAccountCount={2} />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[GOOGLE])

    expect(screen.getByText('google.confirmDisable.description:{"count":2}')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'google.confirmDisable.confirm' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'google.confirmDisable.cancel' })).toBeInTheDocument()
  })

  it('names the key state under the assistant toggle: missing, unreadable or present', () => {
    const { rerender } = render(<PlatformSettingsPanel {...baseProps} />)
    expect(screen.getByText('aiAssistant.notConfigured')).toBeInTheDocument()

    rerender(
      <PlatformSettingsPanel
        {...baseProps}
        openRouterKey={{ status: 'unreadable', hint: null, savedAt: null }}
      />
    )
    expect(screen.getByText('aiAssistant.unreadable')).toBeInTheDocument()
    expect(screen.queryByText('aiAssistant.notConfigured')).not.toBeInTheDocument()

    rerender(
      <PlatformSettingsPanel
        {...baseProps}
        openRouterKey={{ status: 'configured', hint: 'sk-or-v1-…a1b2', savedAt: null }}
      />
    )
    expect(screen.getByText('aiAssistant.hint')).toBeInTheDocument()
  })

  it('folds the OpenRouter key form away while the assistant is disabled', () => {
    const { rerender } = render(<PlatformSettingsPanel {...baseProps} aiAssistantEnabled={false} />)
    expect(screen.queryByText('status.notConfigured')).not.toBeInTheDocument()

    rerender(<PlatformSettingsPanel {...baseProps} aiAssistantEnabled key="enabled" />)
    expect(screen.getByText('status.notConfigured')).toBeInTheDocument()
  })

  it('never requires confirmation for the passkey toggle, regardless of the Google count', () => {
    render(<PlatformSettingsPanel {...baseProps} googleOnlyAccountCount={5} />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[PASSKEY])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
