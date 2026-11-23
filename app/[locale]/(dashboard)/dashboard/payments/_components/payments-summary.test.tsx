import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackingFamily } from './payment-tracking-groups'

let search = ''

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({ Link: () => null }))

const { PaymentsSummary } = await import('./payments-summary')

function family(overrides: Partial<TrackingFamily> & { familyId: string }): TrackingFamily {
  return {
    familyName: overrides.familyId,
    expectedToDate: 100,
    paidToDate: 100,
    overdueAmount: 0,
    dueThisMonth: 0,
    tracked: true,
    annualAmount: 300,
    creditedPaid: 100,
    fullyScheduled: true,
    contactPhone: null,
    ...overrides,
  }
}

const families = [
  family({ familyId: 'late', overdueAmount: 40, dueThisMonth: 70, creditedPaid: 60 }),
  family({ familyId: 'clear' }),
]

const renderSummary = () =>
  render(<PaymentsSummary families={families} uncashedCount={2} locale="fr" currency="EUR" />)

describe('PaymentsSummary', () => {
  beforeEach(() => {
    search = ''
    window.history.replaceState(null, '', '/')
  })

  it('shows what is left this month, the overdue part and the families up to date', () => {
    renderSummary()

    expect(screen.getByRole('button', { name: 'month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/70,00/)).toBeInTheDocument()
    expect(screen.getByText(/^overdue:.*40,00/)).toBeInTheDocument()
    expect(screen.getByText(/upToDateCount:\{"count":1,"total":2\}/)).toBeInTheDocument()
    expect(screen.getByText(/uncashed:\{"count":2\}/)).toBeInTheDocument()
  })

  it('switches to the year and writes it in the URL', () => {
    search = 'horizon=year'
    renderSummary()

    expect(screen.getByRole('button', { name: 'year' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/settledCount:\{"count":0,"total":2\}/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'month' }))
    expect(window.location.search).toBe('?horizon=month')
  })
})
