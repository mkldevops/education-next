import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentHistoryTable } from './payment-history-table'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('./cancel-payment-dialog', () => ({
  CancelPaymentDialog: ({ paymentIds, amount }: { paymentIds: string[]; amount: string }) => (
    <button type="button" data-ids={paymentIds.join(',')}>
      cancel {amount}
    </button>
  ),
}))

const line = (overrides: Record<string, unknown>) => ({
  id: 'p-1',
  familyId: 'family-1',
  enrollmentId: 'enrollment-1',
  amount: 100,
  method: 'CASH',
  reference: null,
  paidAt: new Date('2026-10-01T00:00:00Z'),
  cashedAt: null,
  paymentTransactionId: null,
  receiptId: null,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  enrollment: { student: { person: { name: 'Ali', lastname: 'Maoulana' } } },
  ...overrides,
})

const props = { locale: 'fr', currency: 'EUR' }

const desktopTable = () => screen.getByRole('table')

describe('PaymentHistoryTable cancellation', () => {
  it('offers to cancel every line of a manual family payment together', async () => {
    const payments = [
      line({ id: 'p-1' }),
      line({ id: 'p-2', enrollmentId: 'enrollment-2', amount: 50 }),
    ]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    const button = within(desktopTable()).getByRole('button')
    expect(button).toHaveAttribute('data-ids', 'p-1,p-2')
    expect(button).toHaveTextContent('150,00')
  })

  it('points an online payment to Stripe instead of cancelling it', async () => {
    const payments = [line({ method: 'STRIPE', paymentTransactionId: 'tx-1' })]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    expect(within(desktopTable()).queryByRole('button')).not.toBeInTheDocument()
    expect(within(desktopTable()).getByText('cancel.onlineHint')).toBeInTheDocument()
  })

  it('sends a cashier payment to its receipt instead of cancelling it', async () => {
    const payments = [line({ receiptId: 'receipt-1' })]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    expect(within(desktopTable()).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(desktopTable()).getByRole('link', { name: 'cancel.receiptHint' })
    ).toHaveAttribute('href', '/dashboard/cashier/receipts/receipt-1')
  })

  it('shows no cancellation to a viewer who is not a school admin', async () => {
    render(await PaymentHistoryTable({ ...props, payments: [line({})] as never }))

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('actions')).not.toBeInTheDocument()
  })
})
