import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace.replace('dashboard.pages.config.stripe', 'stripe').replace('dashboard.pages.config', 'config')}.${key}`,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast: { success: toastSuccessMock, error: vi.fn() } }))
vi.mock('../../../_lib/config-actions', () => ({ setConfigAction: vi.fn() }))
vi.mock('../../../_lib/school-currency-actions', () => ({ setSchoolCurrencyAction: vi.fn() }))
vi.mock('../../../_lib/stripe-settings-actions', () => ({
  setStripeEnabledAction: vi.fn(),
  setStripeSecretAction: vi.fn(),
  deleteStripeSecretAction: vi.fn(),
}))

import type { StripeSettings } from '@/use-cases/payments/stripe-settings'
import { setConfigAction } from '../../../_lib/config-actions'
import { setStripeEnabledAction } from '../../../_lib/stripe-settings-actions'
import { PaymentsModule } from './payments-module'

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

/** Ouvre le dialogue du module et y borne les requêtes. */
function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'config.modules.configure' }))
  return within(screen.getByRole('dialog'))
}

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
    <PaymentsModule
      paymentsEnabled={paymentsEnabled}
      paymentFootprint={paymentFootprint}
      settings={settings}
      currency={{ currency: 'EUR', locked: false }}
      webhookUrl={webhookUrl}
      secretStorageConfigured={true}
    />
  )
}

describe('PaymentsModule', () => {
  const writeTextMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextMock.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the stored flag and explains what is missing while the configuration is incomplete', () => {
    renderSection(incomplete)

    expect(screen.getByText('config.modules.toComplete')).toBeInTheDocument()
    const dialog = openDialog()
    expect(dialog.getByLabelText('stripe.toggle.label')).toBeEnabled()
    expect(dialog.getByLabelText('stripe.toggle.label')).toBeChecked()
    expect(dialog.getByText('stripe.toggle.incomplete')).toBeInTheDocument()
    expect(dialog.getByText(webhookUrl)).toBeInTheDocument()
  })

  it('shows Stripe enabled once configured', () => {
    renderSection(configured)

    expect(screen.queryByText('config.modules.toComplete')).not.toBeInTheDocument()
    const dialog = openDialog()
    expect(dialog.getByLabelText('stripe.toggle.label')).toBeEnabled()
    expect(dialog.getByLabelText('stripe.toggle.label')).toBeChecked()
    expect(dialog.queryByText('stripe.toggle.incomplete')).not.toBeInTheDocument()
  })

  it('says when the instance credentials are used', () => {
    renderSection({
      ...incomplete,
      secretKey: 'notConfigured',
      usesEnvFallback: true,
      configured: true,
      available: true,
    })

    expect(openDialog().getByText('stripe.toggle.envFallback')).toBeInTheDocument()
  })

  it('shows stored secrets masked, with replace and delete', () => {
    renderSection(configured)

    const dialog = openDialog()
    expect(dialog.getByText('stripe.secretKey.masked')).toBeInTheDocument()
    expect(dialog.getByText('stripe.webhookSecret.masked')).toBeInTheDocument()
    expect(dialog.getAllByRole('button', { name: 'stripe.replace' })).toHaveLength(2)
    expect(dialog.getAllByRole('button', { name: 'stripe.delete' })).toHaveLength(2)
  })

  it('never prefills a secret input', () => {
    renderSection(configured)
    openDialog()

    for (const input of screen.getByRole('dialog').querySelectorAll('input[type="password"]')) {
      expect(input).toHaveValue('')
    }
  })

  it('displays the webhook URL and copies it', async () => {
    renderSection(configured)

    const dialog = openDialog()
    expect(dialog.getByText(webhookUrl)).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'stripe.webhookUrl.copy' }))

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith(webhookUrl))
    expect(toastSuccessMock).toHaveBeenCalledWith('stripe.webhookUrl.copied')
  })

  it('folds Stripe while payment management is off', () => {
    renderSection(configured, { paymentsEnabled: false })

    expect(screen.getByLabelText(paymentsLabel)).not.toBeChecked()
    expect(
      screen.queryByRole('button', { name: 'config.modules.configure' })
    ).not.toBeInTheDocument()
  })

  it('folds the Stripe credentials while Stripe is off', () => {
    renderSection({ ...configured, enabled: false, available: false })

    const dialog = openDialog()
    expect(dialog.getByLabelText('stripe.toggle.label')).not.toBeChecked()
    expect(dialog.queryByText(webhookUrl)).not.toBeInTheDocument()
  })

  it('unfolds the Stripe credentials as soon as Stripe is switched on', async () => {
    vi.mocked(setStripeEnabledAction).mockResolvedValue('OK')
    renderSection({ ...incomplete, enabled: false })

    const dialog = openDialog()
    fireEvent.click(dialog.getByLabelText('stripe.toggle.label'))

    expect(dialog.getByText(webhookUrl)).toBeInTheDocument()
    await waitFor(() => expect(setStripeEnabledAction).toHaveBeenCalledWith(true))
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

describe('PaymentsModule dialog', () => {
  it('repeats the payments switch above its options, as the module card does', () => {
    renderSection(configured)

    const dialog = openDialog()
    expect(dialog.getByLabelText(paymentsLabel)).toBeChecked()
    expect(dialog.getByText('config.modules.dialogTitle')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'config.modules.close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
