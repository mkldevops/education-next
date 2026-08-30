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

// Three dates whose fr-FR formatted (DD/MM/YYYY) lexicographic order ('A', 'C', 'B') is a
// genuine permutation of their chronological order ('A', 'B', 'C') — not just its exact
// reverse. With only two rows, ascending and descending are always mirror images of each
// other under ANY comparator, so a sort that merely reverses direction (e.g. because the
// accessor's value type flips the table's default click direction, string columns sort
// ascending first, number columns sort descending first) can accidentally render the same
// row order for both a lexicographic and a chronological accessor. A third row that lands in
// a different relative position breaks that coincidence.
const rowA: PaymentRow = {
  ...basePayment,
  id: 'payment-a',
  paidAt: new Date('2023-03-05T00:00:00Z'),
  cashedAt: new Date('2023-03-05T00:00:00Z'),
} // '05/03/2023'
const rowB: PaymentRow = {
  ...basePayment,
  id: 'payment-b',
  paidAt: new Date('2024-11-20T00:00:00Z'),
  cashedAt: new Date('2024-11-20T00:00:00Z'),
} // '20/11/2024'
const rowC: PaymentRow = {
  ...basePayment,
  id: 'payment-c',
  paidAt: new Date('2025-01-10T00:00:00Z'),
  cashedAt: new Date('2025-01-10T00:00:00Z'),
} // '10/01/2025'

// Columns (isAdmin=false): student, amount, method, reference, paidAt, cashedAt.
const CELL_INDEX = { paidAt: 4, cashedAt: 5 } as const

const readColumn = (cellIndex: number) =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[cellIndex].textContent)

const expectChronologicalToggle = (columnId: 'paidAt' | 'cashedAt') => {
  const sortButton = screen.getByRole('button', { name: columnId })
  const ascending = ['05/03/2023', '20/11/2024', '10/01/2025']
  const descending = [...ascending].reverse()

  fireEvent.click(sortButton)
  const firstClick = readColumn(CELL_INDEX[columnId])
  expect([ascending, descending]).toContainEqual(firstClick)

  fireEvent.click(sortButton)
  const secondClick = readColumn(CELL_INDEX[columnId])
  expect([ascending, descending]).toContainEqual(secondClick)
  expect(secondClick).not.toEqual(firstClick)
}

describe('PaymentsTable', () => {
  it('sorts the paidAt column chronologically, not lexicographically', () => {
    render(
      <PaymentsTable payments={[rowB, rowC, rowA]} locale="fr" isAdmin={false} periodName={null} />
    )

    expectChronologicalToggle('paidAt')
  })

  it('sorts the cashedAt column chronologically, not lexicographically', () => {
    render(
      <PaymentsTable payments={[rowB, rowC, rowA]} locale="fr" isAdmin={false} periodName={null} />
    )

    expectChronologicalToggle('cashedAt')
  })
})
