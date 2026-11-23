import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StudentPaymentHistory } from '../_lib/student-payment-history'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { PaymentHistory } = await import('./payment-history')

const history: StudentPaymentHistory = {
  entries: [
    {
      id: 'meal:m1',
      service: 'CANTEEN',
      paidAt: new Date('2026-11-02T08:15:00.000Z'),
      method: 'CARD',
      amount: 42.5,
      coverage: { kind: 'mealDays', days: 10, paidThrough: null },
    },
    {
      id: 'childcare:c1',
      service: 'CHILDCARE',
      paidAt: new Date('2026-10-15T09:00:00.000Z'),
      method: 'TRANSFER',
      amount: 60,
      coverage: { kind: 'month', month: '2026-10' },
    },
    {
      id: 'tuition:p1',
      service: 'TUITION',
      paidAt: new Date('2026-09-05T00:00:00.000Z'),
      method: 'CASH',
      amount: 150,
      coverage: { kind: 'period', name: 'Année 2026-2027' },
    },
  ],
  hasMore: false,
}

const renderHistory = async (value: StudentPaymentHistory) =>
  render(
    await PaymentHistory({
      history: value,
      locale: 'fr',
      currency: 'EUR',
      timeZone: 'Europe/Paris',
    })
  )

describe('PaymentHistory', () => {
  it('lists one row per payment with its service, coverage, method and amount', async () => {
    await renderHistory(history)

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)

    expect(within(rows[0]).getByText('services.CANTEEN')).toHaveClass('bg-amber-100')
    expect(within(rows[0]).getByText(/mealDays/)).toHaveTextContent('CARD')
    expect(within(rows[0]).getByText(/42,50/)).toBeInTheDocument()

    expect(within(rows[1]).getByText('services.CHILDCARE')).toHaveClass('bg-violet-100')
    expect(within(rows[1]).getByText(/octobre 2026/i)).toHaveTextContent('TRANSFER')

    expect(within(rows[2]).getByText('services.TUITION')).toHaveClass('bg-blue-100')
    expect(within(rows[2]).getByText(/Année 2026-2027/)).toHaveTextContent('CASH')
    // Un règlement d'écolage est un jour à minuit UTC : il ne glisse pas à la veille.
    expect(within(rows[2]).getByText(/5 sept\. 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/limited/)).not.toBeInTheDocument()
  })

  it('says only the most recent payments are shown when older ones exist', async () => {
    await renderHistory({ ...history, hasMore: true })

    expect(screen.getByText(/limited/)).toHaveTextContent('"count":3')
  })

  it('shows an empty state when the student has no payment', async () => {
    await renderHistory({ entries: [], hasMore: false })

    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
