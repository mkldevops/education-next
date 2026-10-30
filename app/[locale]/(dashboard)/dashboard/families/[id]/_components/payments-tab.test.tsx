import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentsTab } from './payments-tab'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}))
// The history table owns its grouping and formatting; this test exercises only the new tracking card.
vi.mock('./payment-history-table', () => ({
  PaymentHistoryTable: () => <div data-testid="payment-history" />,
}))

const baseProps = { payments: [], locale: 'fr', currency: 'EUR' }

describe('PaymentsTab tracking', () => {
  it.each([
    null,
    {
      tracked: false,
      expectedToDate: 0,
      paidToDate: 0,
      overdueAmount: 0,
    },
  ])('hides the tracking card when tracking is disabled (%j)', async (tracking) => {
    render(await PaymentsTab({ ...baseProps, tracking }))

    expect(screen.queryByText('expectedToDate')).not.toBeInTheDocument()
    expect(screen.queryByText('overdueAmount')).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-history')).toBeInTheDocument()
  })

  it('shows an up-to-date status when payments cover elapsed deadlines', async () => {
    render(
      await PaymentsTab({
        ...baseProps,
        tracking: {
          tracked: true,
          expectedToDate: 300,
          paidToDate: 400,
          overdueAmount: 0,
        },
      })
    )

    expect(screen.getByText('upToDate')).toBeInTheDocument()
    expect(screen.getByText('expectedToDate').nextElementSibling).toHaveTextContent('300,00')
    expect(screen.getByText('paidToDate').nextElementSibling).toHaveTextContent('400,00')
    expect(screen.getByText('overdueAmount').nextElementSibling).toHaveTextContent('0,00')
  })

  it('labels only the missed installments as overdue, separately from annual outstanding debt', async () => {
    const { container } = render(
      await PaymentsTab({
        ...baseProps,
        tracking: {
          tracked: true,
          expectedToDate: 300,
          paidToDate: 250,
          overdueAmount: 50,
        },
      })
    )

    // For a 1,000 annual price, annual outstanding debt would be 750, but only 50 is late.
    expect(screen.queryByText('upToDate')).not.toBeInTheDocument()
    expect(screen.getByText('expectedToDate').nextElementSibling).toHaveTextContent('300,00')
    expect(screen.getByText('paidToDate').nextElementSibling).toHaveTextContent('250,00')
    const overdueLabel = screen
      .getAllByText('overdueAmount')
      .find((element) => element.tagName === 'DT')
    expect(overdueLabel?.nextElementSibling).toHaveTextContent('50,00')
    expect(container).not.toHaveTextContent('750,00')
    expect(screen.getByText('overdueSubtitle')).toBeInTheDocument()
  })
})
