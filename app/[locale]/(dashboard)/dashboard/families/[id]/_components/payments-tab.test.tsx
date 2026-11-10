import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentsTab } from './payments-tab'

vi.mock('./payment-history-table', () => ({
  PaymentHistoryTable: () => <div data-testid="payment-history" />,
}))
vi.mock('./payment-tracking-card', () => ({
  PaymentTrackingCard: () => <div data-testid="tracking-card" />,
}))

const baseProps = { payments: [], locale: 'fr', currency: 'EUR', timeZone: 'Europe/Paris' }
const tracking = {
  expectedToDate: 0,
  paidToDate: 0,
  overdueAmount: 0,
  dueThisMonth: 0,
  tracked: false,
  annualAmount: 0,
  creditedPaid: 0,
  fullyScheduled: false,
}

describe('PaymentsTab', () => {
  it.each([null, tracking])(
    'hides the tracking card when there is nothing to track (%j)',
    async (value) => {
      render(await PaymentsTab({ ...baseProps, tracking: value }))

      expect(screen.queryByTestId('tracking-card')).not.toBeInTheDocument()
      expect(screen.getByTestId('payment-history')).toBeInTheDocument()
    }
  )

  it.each([
    { ...tracking, tracked: true },
    { ...tracking, annualAmount: 1000 },
  ])('shows the tracking card above the history (%j)', async (value) => {
    render(await PaymentsTab({ ...baseProps, tracking: value }))

    expect(screen.getByTestId('tracking-card')).toBeInTheDocument()
  })
})
