import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace.replace('dashboard.pages.config.stripe', 'stripe').replace('dashboard.pages.config', 'config')}.${key}`,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast: { success: toastSuccessMock, error: vi.fn() } }))
vi.mock('../../../_lib/config-actions', () => ({ setConfigAction: vi.fn() }))
vi.mock('../../../_lib/stripe-settings-actions', () => ({
  setStripeEnabledAction: vi.fn(),
  setStripeSecretAction: vi.fn(),
  deleteStripeSecretAction: vi.fn(),
}))

import type { StripeSettings } from '@/use-cases/payments/stripe-settings'
import { setConfigAction } from '../../../_lib/config-actions'
import { StripeSettingsSection } from './stripe-settings-section'

const configured: StripeSettings = {
  enabled: true,
  secretKey: 'configured',
  webhookSecret: 'configured',
  usesEnvFallback: false,
  configured: true,
  available: true,
}
const incomplete: StripeSettings = {
  enabled: true,
  secretKey: 'configured',
  webhookSecret: 'notConfigured',
  usesEnvFallback: false,
  configured: false,
  available: false,
}
const webhookUrl = 'https://school.test/api/stripe/webhook/school-1'

const paymentsLabel = 'config.settings.payments_enabled.label'

function renderSection(
  settings: StripeSettings,
  {
    paymentsEnabled = true,
    paymentFootprint = { payments: 0, pendingTransactions: 0 },
  }: {
    paymentsEnabled?: boolean
    paymentFootprint?: { payments: number; pendingTransactions: number }
  } = {}
) {
  return render(
    <StripeSettingsSection
      paymentsEnabled={paymentsEnabled}
      paymentFootprint={paymentFootprint}
      settings={settings}
      webhookUrl={webhookUrl}
      secretStorageConfigured={true}
    />
  )
}

describe('StripeSettingsSection', () => {
  const writeTextMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextMock.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('locks the toggle and explains why while the configuration is incomplete', () => {
    renderSection(incomplete)

    expect(screen.getByLabelText('stripe.toggle.label')).toBeDisabled()
    expect(screen.getByLabelText('stripe.toggle.label')).not.toBeChecked()
    expect(screen.getByText('stripe.toggle.incomplete')).toBeInTheDocument()
  })

  it('shows Stripe enabled once configured', () => {
    renderSection(configured)

    expect(screen.getByLabelText('stripe.toggle.label')).toBeEnabled()
    expect(screen.getByLabelText('stripe.toggle.label')).toBeChecked()
    expect(screen.queryByText('stripe.toggle.incomplete')).not.toBeInTheDocument()
  })

  it('says when the instance credentials are used', () => {
    renderSection({
      ...incomplete,
      secretKey: 'notConfigured',
      usesEnvFallback: true,
      configured: true,
      available: true,
    })

    expect(screen.getByText('stripe.toggle.envFallback')).toBeInTheDocument()
  })

  it('shows stored secrets masked, with replace and delete', () => {
    renderSection(configured)

    expect(screen.getByText('stripe.secretKey.masked')).toBeInTheDocument()
    expect(screen.getByText('stripe.webhookSecret.masked')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'stripe.replace' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'stripe.delete' })).toHaveLength(2)
  })

  it('never prefills a secret input', () => {
    const { container } = renderSection(configured)

    for (const input of container.querySelectorAll('input[type="password"]')) {
      expect(input).toHaveValue('')
    }
  })

  it('displays the webhook URL and copies it', async () => {
    renderSection(configured)

    expect(screen.getByText(webhookUrl)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'stripe.webhookUrl.copy' }))

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith(webhookUrl))
    expect(toastSuccessMock).toHaveBeenCalledWith('stripe.webhookUrl.copied')
  })

  it('collapses the Stripe settings while payment management is off', () => {
    const { rerender } = renderSection(configured, { paymentsEnabled: false })

    const toggle = screen.getByLabelText('stripe.toggle.label')
    expect(screen.getByLabelText(paymentsLabel)).not.toBeChecked()
    expect(toggle.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')

    rerender(
      <StripeSettingsSection
        paymentsEnabled={true}
        paymentFootprint={{ payments: 0, pendingTransactions: 0 }}
        settings={configured}
        webhookUrl={webhookUrl}
        secretStorageConfigured={true}
      />
    )

    expect(toggle.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })

  it('asks before cutting payments off a school that already holds one', async () => {
    renderSection(configured, { paymentFootprint: { payments: 3, pendingTransactions: 0 } })

    fireEvent.click(screen.getByLabelText(paymentsLabel))

    expect(
      await screen.findByText('config.settings.payments_enabled.confirmDisable.title')
    ).toBeInTheDocument()
    expect(setConfigAction).not.toHaveBeenCalled()
  })

  it('cuts payments straight off a school that never took any', async () => {
    vi.mocked(setConfigAction).mockResolvedValue({} as never)
    renderSection(configured)

    fireEvent.click(screen.getByLabelText(paymentsLabel))

    await waitFor(() =>
      expect(setConfigAction).toHaveBeenCalledWith({ name: 'payments_enabled', value: 'false' })
    )
  })
})
