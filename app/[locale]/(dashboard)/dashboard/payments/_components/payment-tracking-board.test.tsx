import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { groupFamilies, type TrackingFamily } from './payment-tracking-groups'

let search = ''

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('./outstanding-family-actions', () => ({
  OutstandingFamilyActions: ({ overdueAmount }: { overdueAmount: string }) => (
    <p>actions {overdueAmount}</p>
  ),
}))

const { PaymentTrackingBoard } = await import('./payment-tracking-board')

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
  family({ familyId: 'late', familyName: 'Diallo', overdueAmount: 40, dueThisMonth: 70 }),
  family({ familyId: 'due', familyName: 'Benali', dueThisMonth: 50 }),
  family({ familyId: 'clear', familyName: 'Ahmed' }),
  family({ familyId: 'settled', familyName: 'Éloïse', creditedPaid: 300 }),
  family({ familyId: 'untracked', familyName: 'Sans', tracked: false, annualAmount: 0 }),
]

describe('groupFamilies', () => {
  it('groups the month by what is owed by the end of the month', () => {
    const { groups, total, settledCount, scopeCount } = groupFamilies(families, 'month')

    expect(groups.map((g) => [g.key, g.families.map((f) => f.familyId), g.amount])).toEqual([
      ['late', ['late'], 70],
      ['due', ['due'], 50],
      ['clear', ['clear', 'settled'], 0],
    ])
    expect({ total, settledCount, scopeCount }).toEqual({
      total: 120,
      settledCount: 2,
      scopeCount: 4,
    })
  })

  it('groups the year by what is left on the annual amount', () => {
    const { groups, total, settledCount } = groupFamilies(families, 'year')

    expect(groups.map((g) => [g.key, g.families.map((f) => f.familyId), g.amount])).toEqual([
      ['late', ['late'], 200],
      ['remaining', ['clear', 'due'], 400],
      ['settled', ['settled'], 0],
    ])
    expect({ total, settledCount }).toEqual({ total: 600, settledCount: 1 })
  })

  it('matches the family name regardless of case and accents', () => {
    const { groups } = groupFamilies(families, 'month', 'elo')

    expect(groups.flatMap((g) => g.families.map((f) => f.familyId))).toEqual(['settled'])
  })
})

describe('PaymentTrackingBoard', () => {
  beforeEach(() => {
    search = ''
  })

  const renderBoard = () =>
    render(<PaymentTrackingBoard families={families} locale="fr" currency="EUR" />)

  it('opens only the overdue group by default', () => {
    renderBoard()

    expect(screen.getByRole('button', { name: /groups.late/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: /groups.due/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByText('Diallo')).toBeInTheDocument()
    expect(screen.queryByText('Benali')).not.toBeInTheDocument()
  })

  it('unfolds the family card with its actions and a link to its payments', () => {
    renderBoard()

    fireEvent.click(screen.getByRole('button', { name: /toggleFamily.*Diallo/ }))

    const card = document.getElementById('tracking-family-late') as HTMLElement
    expect(within(card).getByText(/^actions/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'openFamily' })).toHaveAttribute(
      'href',
      '/dashboard/families/late?tab=payments'
    )
  })

  it('opens on the year view from the URL', () => {
    search = 'horizon=year'
    renderBoard()

    expect(screen.getByRole('button', { name: /groups.remaining/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /groups.due/ })).not.toBeInTheDocument()
  })

  it('opens the groups holding a searched family', () => {
    renderBoard()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ben' } })

    expect(screen.getByText('Benali')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /groups.late/ })).not.toBeInTheDocument()
  })
})
