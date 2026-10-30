import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '../../../../../../messages/fr.json'
import { CreatePlanDialog } from './create-plan-dialog'
import { EditPlanDialog } from './edit-plan-dialog'

const { createPlanAction, updatePlanAction } = vi.hoisted(() => ({
  createPlanAction: vi.fn(),
  updatePlanAction: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const parts = `${namespace}.${key}`.split('.')
    let message: unknown = messages
    for (const part of parts) message = (message as Record<string, unknown>)[part]
    let text = String(message ?? key)
    for (const [name, value] of Object.entries(values ?? {}))
      text = text.replace(`{${name}}`, String(value))
    return text
  },
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn() }, toastActionError: vi.fn() }))
vi.mock('../../../_lib/plan-actions', () => ({
  createPlanAction,
  updatePlanAction,
  deactivatePlanAction: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  createPlanAction.mockResolvedValue({ id: 'plan-1' })
  updatePlanAction.mockResolvedValue({ id: 'plan-1' })
})

function openCreate(currency = 'EUR') {
  render(<CreatePlanDialog currency={currency} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau plan' }))
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Temps plein' } })
}

function submit() {
  const form = screen.getByRole('dialog').querySelector('form')
  if (!form) throw new Error('Plan form missing')
  fireEvent.submit(form)
}

describe('Plan pricing and payment schedule forms', () => {
  it('previews the annual total from a monthly price and submits independent tracking settings', async () => {
    openCreate()
    fireEvent.change(screen.getByLabelText('Définir le prix à partir de'), {
      target: { value: 'MONTHLY' },
    })
    fireEvent.change(screen.getByLabelText('Mensualité (€)'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Nombre de mois facturés'), { target: { value: '9' } })
    expect(screen.getByText(/Total annuel : 900/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Échéancier'), { target: { value: 'MONTHLY' } })
    fireEvent.change(screen.getByLabelText('Premier mois'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Nombre de versements'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Jour limite de paiement'), { target: { value: '15' } })
    expect(screen.getByText(/6 versement\(s\) d’environ 150/)).toBeInTheDocument()
    submit()
    await waitFor(() =>
      expect(createPlanAction).toHaveBeenCalledWith({
        name: 'Temps plein',
        pricing: { mode: 'MONTHLY', amount: 100, months: 9 },
        paymentSchedule: { mode: 'MONTHLY', firstMonth: 10, count: 6, dueDay: 15 },
      })
    )
  })

  it('limits installment tracking to five editable dates and allows removing a payment', () => {
    openCreate()
    fireEvent.change(screen.getByLabelText('Échéancier'), { target: { value: 'INSTALLMENTS' } })
    const add = screen.getByRole('button', { name: 'Ajouter un versement' })
    for (let index = 0; index < 4; index++) fireEvent.click(add)
    expect(add).toBeDisabled()
    expect(screen.getByLabelText('Versement 5 : mois')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le versement 2' }))
    expect(screen.queryByLabelText('Versement 5 : mois')).not.toBeInTheDocument()
    expect(add).toBeEnabled()
    expect(screen.getByLabelText('Versement 2 : mois')).toHaveValue('11')
  })

  it('loads monthly pricing and quarterly tracking without changing their values on edit', async () => {
    render(
      <EditPlanDialog
        currency="EUR"
        openEnrollments={2}
        plan={{
          id: 'plan-1',
          name: 'Temps plein',
          amount: 800,
          pricing: { mode: 'MONTHLY', amount: 80, months: 10 },
          paymentSchedule: { mode: 'QUARTERLY', firstMonth: 9, count: 3, dueDay: 20 },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le plan' }))
    expect(screen.getByLabelText('Mensualité (€)')).toHaveValue(80)
    expect(screen.getByLabelText('Échéancier')).toHaveValue('QUARTERLY')
    expect(screen.getByLabelText('Nombre de versements')).toHaveAttribute('max', '4')
    submit()
    await waitFor(() =>
      expect(updatePlanAction).toHaveBeenCalledWith('plan-1', {
        name: 'Temps plein',
        pricing: { mode: 'MONTHLY', amount: 80, months: 10 },
        paymentSchedule: { mode: 'QUARTERLY', firstMonth: 9, count: 3, dueDay: 20 },
      })
    )
  })

  it('disables due-date tracking while keeping the annual price', async () => {
    openCreate()
    fireEvent.change(screen.getByLabelText('Prix annuel (€)'), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText('Échéancier'), { target: { value: 'QUARTERLY' } })
    fireEvent.change(screen.getByLabelText('Échéancier'), { target: { value: 'NONE' } })
    expect(screen.queryByLabelText('Jour limite de paiement')).not.toBeInTheDocument()
    submit()
    await waitFor(() =>
      expect(createPlanAction).toHaveBeenCalledWith({
        name: 'Temps plein',
        pricing: { mode: 'ANNUAL', amount: 600 },
        paymentSchedule: { mode: 'NONE' },
      })
    )
  })

  it('keeps whole-unit price inputs when switching a zero-decimal currency to monthly pricing', () => {
    openCreate('KMF')
    fireEvent.change(screen.getByLabelText('Prix annuel (KMF)'), { target: { value: '999' } })
    fireEvent.change(screen.getByLabelText('Définir le prix à partir de'), {
      target: { value: 'MONTHLY' },
    })
    expect(screen.getByLabelText('Mensualité (KMF)')).toHaveValue(100)
    expect(screen.getByLabelText('Mensualité (KMF)')).toHaveAttribute('step', '1')
  })
})
