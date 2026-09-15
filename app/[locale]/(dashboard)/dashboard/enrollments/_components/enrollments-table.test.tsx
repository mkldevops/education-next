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
