import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FamilyPaymentTrackingDetail } from '@/use-cases/payments/payment-tracking'
import { PaymentTrackingCard } from './payment-tracking-card'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values && 'amount' in values ? `${key}:${values.amount}` : key
    t.rich = (key: string) => key
    return t
  },
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}))

const baseProps = { locale: 'fr', currency: 'EUR', timeZone: 'Europe/Paris' }

function tracking(overrides: Partial<FamilyPaymentTrackingDetail> = {}) {
  return {
    expectedToDate: 300,
    paidToDate: 300,
    overdueAmount: 0,
    dueThisMonth: 0,
    tracked: true,
    annualAmount: 1000,
    creditedPaid: 300,
    fullyScheduled: true,
    ...overrides,
  }
}

const card = () => screen.getByRole('region', { name: 'title' })

describe('PaymentTrackingCard', () => {
  it('names the advance and says nothing is due', async () => {
    render(
      await PaymentTrackingCard({
        ...baseProps,
        tracking: tracking({ expectedToDate: 320, paidToDate: 480, creditedPaid: 480 }),
      })
    )

    expect(card()).toHaveAttribute('data-state', 'ahead')
    expect(screen.getByText(/^status\.ahead:160,00/)).toBeInTheDocument()
    expect(screen.getByText('nothingDue')).toBeInTheDocument()
    expect(screen.getByText('figures.expectedToDate').parentElement).toHaveTextContent('320,00')
  })

  it('leads with the amount to collect this month when late, and marks the gap on the bar', async () => {
    const { container } = render(
      await PaymentTrackingCard({
        ...baseProps,
        tracking: tracking({
          expectedToDate: 400,
          paidToDate: 240,
          creditedPaid: 240,
          overdueAmount: 160,
          dueThisMonth: 240,
        }),
      })
    )

    expect(card()).toHaveAttribute('data-state', 'late')
    expect(screen.getByText(/^status\.late:160,00/)).toBeInTheDocument()
    expect(screen.getByText(/^240,00/, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName('year.barLabelLate')
    expect(container.querySelector('.outline-red-600')).not.toBeNull()
  })

  it('drops the expected marker when some enrollments have no schedule', async () => {
    render(
      await PaymentTrackingCard({ ...baseProps, tracking: tracking({ fullyScheduled: false }) })
    )

    expect(screen.getByRole('img')).toHaveAccessibleName('year.barLabelSimple')
  })

  it('shows the year as settled without the deadline explanation', async () => {
    render(
      await PaymentTrackingCard({
        ...baseProps,
        tracking: tracking({ creditedPaid: 1000, paidToDate: 1000 }),
      })
    )

    expect(card()).toHaveAttribute('data-state', 'settled')
    expect(screen.getByText('nothingDueYear')).toBeInTheDocument()
    expect(screen.queryByText('how.summary')).not.toBeInTheDocument()
    expect(screen.getByText('figures.total')).toBeInTheDocument()
  })

  it('keeps the annual progress for a family without any schedule', async () => {
    render(
      await PaymentTrackingCard({
        ...baseProps,
        tracking: tracking({ tracked: false, fullyScheduled: false, expectedToDate: 0 }),
      })
    )

    expect(card()).toHaveAttribute('data-state', 'untracked')
    expect(screen.getByText('detail.untracked')).toBeInTheDocument()
    expect(screen.queryByText('figures.expectedToDate')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName('year.barLabelSimple')
  })
})
