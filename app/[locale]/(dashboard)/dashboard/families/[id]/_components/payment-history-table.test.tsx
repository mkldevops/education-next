import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentHistoryTable } from './payment-history-table'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('./payment-row-menu', () => ({
  PaymentRowMenu: (props: {
    paymentIds: string[]
    receiptId: string | null
    isOnline: boolean
    amount: string
    isRefund: boolean
  }) => (
    <button
      type="button"
      data-ids={props.paymentIds.join(',')}
      data-receipt={props.receiptId ?? ''}
      data-online={String(props.isOnline)}
      data-refund={String(props.isRefund)}
    >
      actions {props.amount}
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

describe('PaymentHistoryTable actions', () => {
  it('gives the row menu every line of a manual family payment together', async () => {
    const payments = [
      line({ id: 'p-1' }),
      line({ id: 'p-2', enrollmentId: 'enrollment-2', amount: 50 }),
    ]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    const menu = within(desktopTable()).getByRole('button', { name: /actions/ })
    expect(menu).toHaveAttribute('data-ids', 'p-1,p-2')
    expect(menu).toHaveAttribute('data-receipt', '')
    expect(menu).toHaveTextContent('150,00')
  })

  it('flags a refund', async () => {
    render(
      await PaymentHistoryTable({
        ...props,
        payments: [line({ amount: -50 })] as never,
        canCancel: true,
      })
    )

    expect(within(desktopTable()).getByRole('button')).toHaveAttribute('data-refund', 'true')
  })

  it('flags an online payment', async () => {
    const payments = [line({ method: 'STRIPE', paymentTransactionId: 'tx-1' })]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    expect(within(desktopTable()).getByRole('button')).toHaveAttribute('data-online', 'true')
  })

  it('passes the receipt of a payment that has one', async () => {
    const payments = [line({ receiptId: 'receipt-1' })]
    render(await PaymentHistoryTable({ ...props, payments: payments as never, canCancel: true }))

    expect(within(desktopTable()).getByRole('button')).toHaveAttribute('data-receipt', 'receipt-1')
  })

  it('shows no actions to a viewer who is not a school admin', async () => {
    render(await PaymentHistoryTable({ ...props, payments: [line({})] as never }))

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('actions')).not.toBeInTheDocument()
  })
})
