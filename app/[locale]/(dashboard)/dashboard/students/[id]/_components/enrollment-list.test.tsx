import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Enrollment, Payment, Plan } from '@/generated/prisma/client'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy. Même motif
// que `hero-banner.test.tsx`.
const { EnrollmentList } = await import('./enrollment-list')

type EnrollmentWithRelation = Enrollment & {
  plan: Plan
  payments: Payment[]
  classAssignments: []
}

const enrollment = (planName: string): EnrollmentWithRelation =>
  ({
    id: 'enrollment-1',
    status: 'PENDING',
    totalAmount: 100,
    discount: 0,
    registeredAt: new Date('2026-01-01T00:00:00Z'),
    payments: [],
    classAssignments: [],
    plan: { name: planName },
  }) as unknown as EnrollmentWithRelation

describe('EnrollmentList with payments enabled', () => {
  it('shows the unpriced badge instead of the reserved plan name, never the raw stored name', async () => {
    render(
      await EnrollmentList({
        enrollments: [enrollment('__unpriced__')],
        locale: 'fr',
        currency: 'EUR',
        paymentsEnabled: true,
      })
    )

    expect(screen.getByText('unpriced.badge')).toBeInTheDocument()
    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
  })

  it('names a priced plan normally', async () => {
    render(
      await EnrollmentList({
        enrollments: [enrollment('Tarif annuel')],
        locale: 'fr',
        currency: 'EUR',
        paymentsEnabled: true,
      })
    )

    expect(screen.getByText('Tarif annuel')).toBeInTheDocument()
  })
})

describe('EnrollmentList with payments disabled', () => {
  it('hides the plan name and the payment progress entirely', async () => {
    render(
      await EnrollmentList({
        enrollments: [enrollment('Tarif annuel')],
        locale: 'fr',
        currency: 'EUR',
        paymentsEnabled: false,
      })
    )

    expect(screen.queryByText('Tarif annuel')).not.toBeInTheDocument()
    expect(screen.queryByText('unpriced.badge')).not.toBeInTheDocument()
    expect(screen.queryByText('enrollmentList.remaining')).not.toBeInTheDocument()
    expect(screen.queryByText('enrollmentList.settled')).not.toBeInTheDocument()
  })
})

describe('EnrollmentList covered months', () => {
  it('marks each monthly deadline paid, partly paid or unpaid from the amount received', async () => {
    const monthly = {
      ...enrollment('Forfait Maternelle'),
      status: 'ACTIVE',
      totalAmount: 48000,
      startMonth: null,
      plan: {
        name: 'Forfait Maternelle',
        paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 3, dueDay: 10 },
      },
      payments: [{ amount: 24000 }],
      classAssignments: [
        {
          classPeriod: {
            name: 'MS',
            level: { name: 'Maternelle' },
            period: { name: '2026-2027', startAt: new Date('2026-09-01T00:00:00Z') },
          },
        },
      ],
    } as unknown as EnrollmentWithRelation

    render(
      await EnrollmentList({
        enrollments: [monthly],
        locale: 'fr',
        currency: 'EUR',
        paymentsEnabled: true,
      })
    )

    expect(screen.getByText('enrollmentList.coveredMonths')).toBeInTheDocument()
    expect(screen.getAllByLabelText('enrollmentList.installmentStatus.PAID')).toHaveLength(1)
    expect(screen.getAllByLabelText('enrollmentList.installmentStatus.PARTIAL')).toHaveLength(1)
    expect(screen.getAllByLabelText('enrollmentList.installmentStatus.UNPAID')).toHaveLength(1)
  })
})
