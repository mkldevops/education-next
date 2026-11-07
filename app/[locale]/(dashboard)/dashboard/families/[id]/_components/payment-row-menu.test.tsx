import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const issueReceiptForPaymentsAction = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = () => false
    return t
  },
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  toastActionError: vi.fn(),
}))
vi.mock('../../../../_lib/payment-actions', () => ({
  issueReceiptForPaymentsAction: (ids: string[]) => issueReceiptForPaymentsAction(ids),
}))
vi.mock('./cancel-payment-dialog', () => ({
  CancelPaymentDialogContent: () => null,
}))

const { PaymentRowMenu } = await import('./payment-row-menu')

const base = { paymentIds: ['p-1', 'p-2'], amount: '150,00 €', isRefund: false }

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'actions' }))
const items = () => screen.getAllByRole('menuitem').map((item) => item.textContent)

describe('PaymentRowMenu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('issues a receipt for a manual payment without one, then opens it', async () => {
    issueReceiptForPaymentsAction.mockResolvedValue({ receiptId: 'r-1' })
    render(<PaymentRowMenu {...base} receiptId={null} isOnline={false} />)

    openMenu()
    expect(items()).toEqual(['trigger', 'cancel.trigger'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'trigger' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/cashier/receipts/r-1'))
    expect(issueReceiptForPaymentsAction).toHaveBeenCalledWith(['p-1', 'p-2'])
  })

  it('offers no receipt for a refund', () => {
    render(<PaymentRowMenu {...base} isRefund receiptId={null} isOnline={false} />)

    openMenu()
    expect(items()).toEqual(['cancel.trigger'])
  })

  it('sends a payment with a receipt to that receipt', () => {
    render(<PaymentRowMenu {...base} receiptId="r-9" isOnline={false} />)

    openMenu()
    expect(items()).toEqual(['viewReceipt', 'cancelReceipt'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'cancelReceipt' }))
    expect(push).toHaveBeenCalledWith('/dashboard/cashier/receipts/r-9?action=cancel')
  })

  it('only points an online payment to Stripe', () => {
    render(<PaymentRowMenu {...base} receiptId="r-3" isOnline />)

    openMenu()
    expect(items()).toEqual(['viewReceipt', 'cancel.onlineHint'])
    expect(screen.getByRole('menuitem', { name: 'cancel.onlineHint' })).toBeDisabled()
  })
})
