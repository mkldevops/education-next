import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormerStudentRow } from '@/use-cases/students/former-students'
import { FormerStudentsTable } from './former-students-table'
import { StudentsStatusToggle } from './students-status-toggle'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = () => true
    return t
  },
}))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('./reinstate-student-button', () => ({
  ReinstateStudentButton: ({ studentId }: { studentId: string }) => (
    <button type="button">reinstate {studentId}</button>
  ),
}))

const rows: FormerStudentRow[] = [
  {
    id: 'owing',
    name: 'Inès Doit',
    family: { id: 'family-1', name: 'Famille Doit' },
    lastClass: { name: 'CE1 B', period: '2026-2027' },
    leftAt: new Date('2027-01-10T00:00:00.000Z'),
    remaining: 250,
  },
  {
    id: 'settled',
    name: 'Sami Solde',
    family: null,
    lastClass: null,
    leftAt: null,
    remaining: 0,
  },
]

const renderTable = (props: Partial<React.ComponentProps<typeof FormerStudentsTable>> = {}) =>
  render(
    <FormerStudentsTable
      data={rows}
      locale="fr"
      currency="EUR"
      showRemaining
      canReinstate
      {...props}
    />
  )

describe('FormerStudentsTable', () => {
  it('shows the last class, the departure month and what is still owed', () => {
    renderTable()

    expect(screen.getByText('CE1 B')).toBeInTheDocument()
    expect(screen.getByText('janvier 2027')).toBeInTheDocument()
    expect(screen.getByText(/250/)).toHaveClass('text-amber-600')
    expect(screen.getByRole('button', { name: 'reinstate owing' })).toBeInTheDocument()
  })

  it('hides the money and the reinstatement from a reader without those rights', () => {
    renderTable({ showRemaining: false, canReinstate: false })

    expect(screen.queryByText('remainingDue')).not.toBeInTheDocument()
    expect(screen.queryByText(/250/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reinstate/ })).not.toBeInTheDocument()
  })
})

describe('StudentsStatusToggle', () => {
  it('links both views with their counts and marks the current one', async () => {
    render(await StudentsStatusToggle({ status: 'former', activeCount: 12, formerCount: 3 }))

    const active = screen.getByRole('link', { name: /statusActive/ })
    const former = screen.getByRole('link', { name: /statusFormer/ })
    expect(active).toHaveAttribute('href', '/dashboard/students')
    expect(active).toHaveTextContent('12')
    expect(former).toHaveAttribute('href', '/dashboard/students?status=former')
    expect(former).toHaveAttribute('aria-current', 'page')
    expect(former).toHaveTextContent('3')
  })
})
