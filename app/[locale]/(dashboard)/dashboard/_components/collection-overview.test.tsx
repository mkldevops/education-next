import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/decimal', () => ({ formatCurrency: (amount: number) => `¤${amount}` }))

const { CollectionOverview } = await import('./collection-overview')

const payments = {
  totals: {
    due: 1000,
    collected: 600,
    remaining: 400,
    collectionRate: 60,
    enrollmentCount: 5,
    settledCount: 2,
    outstandingCount: 3,
    paymentCount: 4,
    uncashedAmount: 0,
    uncashedCount: 0,
  },
  tracking: {
    expectedToDate: 900,
    overdueAmount: 300,
    paidToDate: 600,
    dueThisMonth: 350,
    dueThisMonthCount: 2,
    trackedCount: 5,
    tracked: true,
  },
}

const meals = {
  services: [
    { service: 'CANTEEN' as const, subscribed: 10, upToDate: 4, overdue: 6, dueAmount: 250 },
  ],
  dueAmount: 250,
}

const renderOverview = async (props: Partial<Parameters<typeof CollectionOverview>[0]>) =>
  render(
    await CollectionOverview({
      payments: null,
      meals: null,
      locale: 'fr',
      currency: 'KMF',
      ...props,
    })
  )

describe('CollectionOverview', () => {
  it('opens on what is left to collect this month, tuition and meals together', async () => {
    await renderOverview({ payments, meals })

    expect(screen.getByText('outstandingMonth')).toBeInTheDocument()
    expect(screen.getByText('¤600')).toBeInTheDocument()
    expect(screen.getByText('tuitionMonthHint:{"upToDate":3,"tracked":5}')).toBeInTheDocument()
  })

  it('switches to the amount left for the whole year', async () => {
    await renderOverview({ payments, meals })
    fireEvent.click(screen.getByRole('button', { name: 'year' }))

    expect(screen.getByRole('button', { name: 'year' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('outstandingYear')).toBeInTheDocument()
    expect(screen.getByText('¤650')).toBeInTheDocument()
    expect(screen.getByText('overdue:{"amount":"¤300"}')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tuition/ })).toHaveAttribute(
      'href',
      '/dashboard/payments'
    )
    expect(screen.getByRole('link', { name: /CANTEEN/ })).toHaveAttribute(
      'href',
      '/dashboard/cashier/debtors'
    )
  })

  it('shows only meal dues when payments are off', async () => {
    await renderOverview({ meals })

    expect(screen.queryByRole('link', { name: /tuition/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^overdue/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CANTEEN/ })).toBeInTheDocument()
  })

  it('shows only the yearly amount, without switch, when no schedule is tracked', async () => {
    await renderOverview({
      payments: { ...payments, tracking: { ...payments.tracking, tracked: false } },
    })

    expect(screen.queryByText(/^overdue/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'month' })).not.toBeInTheDocument()
    expect(screen.getByText('outstanding')).toBeInTheDocument()
    expect(screen.getAllByText('¤400')).toHaveLength(2)
  })
})
