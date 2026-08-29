import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PaymentRow } from './payments-table'
import { PaymentsTable } from './payments-table'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = () => true
    return t
  },
}))

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}))

const basePayment: Omit<PaymentRow, 'id' | 'paidAt' | 'cashedAt'> = {
  enrollmentId: 'enrollment-1',
  familyName: 'Dupont',
  studentName: 'Alice Dupont',
  amount: 100,
  method: 'CASH',
  reference: null,
}

// These two dates format (fr-FR) to strings that sort in the OPPOSITE order of their
// chronological order: '01/12/2025' < '02/01/2024' lexicographically, but 2024-01-02
// happened first. This is what previously made the column sort by text, not by date.
const earlierPayment: PaymentRow = {
  ...basePayment,
  id: 'payment-earlier',
  paidAt: new Date('2024-01-02T00:00:00Z'),
  cashedAt: null,
}

const laterPayment: PaymentRow = {
  ...basePayment,
  id: 'payment-later',
  paidAt: new Date('2025-12-01T00:00:00Z'),
  cashedAt: null,
}

describe('PaymentsTable', () => {
  it('sorts the paidAt column chronologically, not lexicographically', () => {
    render(
      <PaymentsTable
        payments={[laterPayment, earlierPayment]}
        locale="fr"
        isAdmin={false}
        periodName={null}
      />
    )

    const sortButton = screen.getByRole('button', { name: 'paidAt' })
    // Columns (isAdmin=false): student, amount, method, reference, paidAt, cashedAt.
    const readDates = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[4].textContent)

    // Numeric/date columns sort descending on the first click: most recent date first.
    fireEvent.click(sortButton)
    expect(readDates()).toEqual(['01/12/2025', '02/01/2024'])

    // Second click reverses to ascending: earliest date first.
    fireEvent.click(sortButton)
    expect(readDates()).toEqual(['02/01/2024', '01/12/2025'])
  })
})
