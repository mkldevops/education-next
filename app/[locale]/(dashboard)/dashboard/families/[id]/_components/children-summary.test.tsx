import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('@/features/enums', () => ({
  EnrollmentStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}))
// `calculateFamilyBalance` est pur, mais son module importe le client Prisma.
vi.mock('@/lib/db', () => ({ db: {} }))

const { ChildrenSummary } = await import('./children-summary')

type Students = Parameters<typeof ChildrenSummary>[0]['students']

const students = [
  {
    person: {
      id: 'person-1',
      name: 'Yasmine',
      lastname: 'Benali',
      student: {
        id: 'student-1',
        enrollments: [
          {
            id: 'enrollment-2',
            status: 'ACTIVE',
            totalAmount: 300,
            discount: 0,
            payments: [{ amount: 100 }],
            classAssignments: [{ classPeriod: { id: 'class-1', name: 'CP A' } }],
          },
          {
            id: 'enrollment-1',
            status: 'COMPLETED',
            totalAmount: 200,
            discount: 0,
            payments: [],
            classAssignments: [],
          },
        ],
      },
    },
  },
  {
    person: {
      id: 'person-2',
      name: 'Adam',
      lastname: 'Benali',
      student: { id: 'student-2', enrollments: [] },
    },
  },
] as unknown as Students

describe('ChildrenSummary', () => {
  it('lists each child with a link, class, latest enrollment status and balance', async () => {
    render(
      await ChildrenSummary({ students, locale: 'fr', currency: 'EUR', paymentsEnabled: true })
    )

    const [yasmine, adam] = screen.getAllByRole('listitem')

    expect(within(yasmine).getByRole('link', { name: 'Yasmine' })).toHaveAttribute(
      'href',
      '/dashboard/students/student-1'
    )
    expect(within(yasmine).getByText('CP A')).toBeInTheDocument()
    expect(within(yasmine).getByText('ACTIVE')).toBeInTheDocument()
    // Seule l'inscription payable doit encore : la terminée ne compte pas dans le solde.
    expect(within(yasmine).getByText(/childCard\.remaining.*200/)).toBeInTheDocument()

    expect(within(adam).getByRole('link', { name: 'Adam' })).toHaveAttribute(
      'href',
      '/dashboard/students/student-2'
    )
    expect(within(adam).getByText('childCard.noClass')).toBeInTheDocument()
    expect(within(adam).getByText('childCard.noEnrollments')).toBeInTheDocument()
    expect(within(adam).getByText('childCard.settled')).toBeInTheDocument()
  })

  it('hides balances when payments are disabled', async () => {
    render(
      await ChildrenSummary({ students, locale: 'fr', currency: 'EUR', paymentsEnabled: false })
    )

    expect(screen.queryByText(/childCard\.remaining/)).not.toBeInTheDocument()
    expect(screen.queryByText('childCard.settled')).not.toBeInTheDocument()
  })

  it('shows the empty state without children', async () => {
    render(
      await ChildrenSummary({ students: [], locale: 'fr', currency: 'EUR', paymentsEnabled: true })
    )

    expect(screen.getByText('sections.noChildren')).toBeInTheDocument()
  })
})
