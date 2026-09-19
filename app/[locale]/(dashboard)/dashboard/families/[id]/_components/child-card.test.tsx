import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
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
vi.mock('../../../enrollments/_components/reassign-class-dialog', () => ({
  ReassignClassDialog: () => null,
}))
vi.mock('./activate-enrollment-button', () => ({ ActivateEnrollmentButton: () => null }))
vi.mock('./enroll-button', () => ({ EnrollButton: () => null }))
vi.mock('./enrollment-menu', () => ({ EnrollmentMenu: () => null }))

const { ChildCard } = await import('./child-card')

const student = (planName: string) =>
  ({
    person: {
      id: 'person-1',
      name: 'Yasmine',
      lastname: 'Benali',
      student: {
        id: 'student-1',
        birthday: null,
        allergies: null,
        enrollments: [
          {
            id: 'enrollment-1',
            status: 'PENDING',
            totalAmount: 300,
            plan: { name: planName },
            payments: [{ amount: 100 }],
            classAssignments: [],
          },
        ],
      },
    },
  }) as unknown as Parameters<typeof ChildCard>[0]['student']

const baseProps = {
  locale: 'fr',
  familyId: 'family-1',
  isAdmin: false,
  classes: [],
  canEnroll: false,
}

describe('ChildCard', () => {
  it('hides the plan, amounts and progress when payments are disabled', async () => {
    render(
      await ChildCard({ ...baseProps, student: student('__unpriced__'), paymentsEnabled: false })
    )

    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('shows the plan and payment progress when payments are enabled', async () => {
    render(await ChildCard({ ...baseProps, student: student('Annuel'), paymentsEnabled: true }))

    expect(screen.getByText('Annuel')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows the unpriced badge instead of the reserved plan name', async () => {
    render(
      await ChildCard({ ...baseProps, student: student('__unpriced__'), paymentsEnabled: true })
    )

    expect(screen.getByText('unpriced.badge')).toBeInTheDocument()
    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
  })
})

describe('ChildCard class link', () => {
  const assigned = () => {
    const value = student('Annuel')
    value.person.student.enrollments[0].classAssignments = [
      { classPeriod: { id: 'class-1', name: 'CP A' } },
    ] as unknown as (typeof value.person.student.enrollments)[number]['classAssignments']
    return value
  }

  it('shows the class as plain text to a parent, the class page being admin-only', async () => {
    render(await ChildCard({ ...baseProps, student: assigned(), paymentsEnabled: false }))

    expect(screen.getByText('CP A')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'CP A' })).not.toBeInTheDocument()
  })

  it('links the class for an admin', async () => {
    render(
      await ChildCard({ ...baseProps, isAdmin: true, student: assigned(), paymentsEnabled: false })
    )

    expect(screen.getByRole('link', { name: 'CP A' })).toHaveAttribute(
      'href',
      '/dashboard/classes/class-1'
    )
  })
})

describe('ActivityFeed', () => {
  it('omits payments and the reserved plan name when payments are disabled', async () => {
    const { ActivityFeed } = await import('./activity-feed')
    const enrollment = {
      id: 'enrollment-1',
      registeredAt: new Date('2026-09-01T00:00:00.000Z'),
      plan: { name: '__unpriced__' },
      studentName: 'Yasmine Benali',
      classAssignments: [],
    }

    render(
      await ActivityFeed({
        enrollments: [enrollment] as unknown as Parameters<typeof ActivityFeed>[0]['enrollments'],
        payments: [
          {
            id: 'payment-1',
            amount: 100,
            paidAt: new Date('2026-09-02T00:00:00.000Z'),
          },
        ] as unknown as Parameters<typeof ActivityFeed>[0]['payments'],
        locale: 'fr',
        paymentsEnabled: false,
      })
    )

    expect(screen.getByText('activity.enrollment')).toBeInTheDocument()
    expect(screen.queryByText('activity.payment')).not.toBeInTheDocument()
    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
  })
})
