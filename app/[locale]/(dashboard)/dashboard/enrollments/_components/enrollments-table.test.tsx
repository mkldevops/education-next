import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EnrollmentDrawerData } from './enrollment-drawer'
import { EnrollmentsTable } from './enrollments-table'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
// Chaîne importée par le tiroir (dialogues d'action) : une action serveur véritable
// exigerait une base et une session, hors de portée d'un test de rendu pur.
vi.mock('../../../_lib/enrollment-actions', () => ({
  activateEnrollmentAction: vi.fn(),
  cancelEnrollmentAction: vi.fn(),
  completeEnrollmentAction: vi.fn(),
  applyDiscountAction: vi.fn(),
  reassignClassAction: vi.fn(),
  setEnrollmentPlanAction: vi.fn(),
}))

const baseEnrollment: EnrollmentDrawerData = {
  id: 'enrollment-1',
  status: 'PENDING',
  totalAmount: 100,
  discount: 0,
  registeredAt: new Date('2026-01-01T00:00:00Z'),
  student: {
    person: { name: 'Alice', lastname: 'Martin', families: [] },
  },
  plan: { name: 'Tarif annuel' },
  classAssignments: [],
  payments: [],
}

const payment = (id: string, amount: number): EnrollmentDrawerData['payments'][number] => ({
  id,
  amount,
  method: 'CASH',
  reference: null,
  paidAt: new Date('2026-01-02T00:00:00Z'),
  cashedAt: null,
})

const reservedEnrollment: EnrollmentDrawerData = {
  ...baseEnrollment,
  id: 'enrollment-2',
  student: {
    person: { name: 'Bob', lastname: 'Dupont', families: [] },
  },
  plan: { name: '__unpriced__' },
}

describe('EnrollmentsTable with payments enabled', () => {
  it('shows the unpriced badge instead of the reserved plan name, and never the raw stored name', () => {
    render(
      <EnrollmentsTable
        enrollments={[reservedEnrollment]}
        isAdmin={true}
        availableClasses={[]}
        availablePlans={[]}
        paymentsEnabled={true}
        locale="fr"
        periodName={null}
      />
    )

    expect(screen.getByText('unpriced.badge')).toBeInTheDocument()
    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
  })

  it('shows no balance badge when cents-split payments settle the enrollment (#424)', () => {
    render(
      <EnrollmentsTable
        enrollments={[
          {
            ...baseEnrollment,
            totalAmount: 30.3,
            payments: [payment('p1', 10.1), payment('p2', 20.2)],
          },
        ]}
        isAdmin={true}
        availableClasses={[]}
        availablePlans={[]}
        paymentsEnabled={true}
        locale="fr"
        periodName={null}
      />
    )

    expect(screen.queryByText(/balanceBadge/)).not.toBeInTheDocument()
  })

  it('shows the balance badge while money is still owed', () => {
    render(
      <EnrollmentsTable
        enrollments={[{ ...baseEnrollment, totalAmount: 30.3, payments: [payment('p1', 10.1)] }]}
        isAdmin={true}
        availableClasses={[]}
        availablePlans={[]}
        paymentsEnabled={true}
        locale="fr"
        periodName={null}
      />
    )

    expect(screen.getByText(/balanceBadge/)).toBeInTheDocument()
  })

  it('names a priced plan normally', () => {
    render(
      <EnrollmentsTable
        enrollments={[baseEnrollment]}
        isAdmin={true}
        availableClasses={[]}
        availablePlans={[]}
        paymentsEnabled={true}
        locale="fr"
        periodName={null}
      />
    )

    expect(screen.getByText('Tarif annuel')).toBeInTheDocument()
  })
})

describe('EnrollmentsTable with payments disabled', () => {
  it('hides the plan and total amount columns entirely', () => {
    render(
      <EnrollmentsTable
        enrollments={[baseEnrollment]}
        isAdmin={true}
        availableClasses={[]}
        availablePlans={[]}
        paymentsEnabled={false}
        locale="fr"
        periodName={null}
      />
    )

    expect(screen.queryByText('Tarif annuel')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'totalAmount' })).not.toBeInTheDocument()
  })
})
