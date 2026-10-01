import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  family: { findMany: vi.fn() },
  payment: { groupBy: vi.fn() },
}
const requireSchoolScopeMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  redirect: () => {
    throw new Error('redirect')
  },
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('../../_lib/auth-helper', () => ({ requireSchoolScope: requireSchoolScopeMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: FamiliesPage } = await import('./page')

const family = (id: string, name: string) => ({
  id,
  name,
  emergencyContactName: null,
  emergencyContactPhone: null,
  persons: [
    {
      person: {
        families: [{ familyId: id, relationType: 'OTHER' as const }],
        student: {
          enrollments: [
            {
              id: `${id}-enrollment`,
              status: 'ACTIVE' as const,
              totalAmount: 100,
              discount: 0,
              payments: [
                {
                  amount: 40,
                  method: 'CASH' as const,
                  paidAt: new Date('2026-01-05'),
                  cashedAt: null,
                },
              ],
              _count: { payments: 1 },
            },
          ],
        },
      },
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolScopeMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
  dbMock.family.findMany.mockResolvedValue([family('family-1', 'Dupont')])
  dbMock.payment.groupBy.mockResolvedValue([
    { enrollmentId: 'family-1-enrollment', _sum: { amount: 40 } },
  ])
})

describe('FamiliesPage', () => {
  it('shows the settlement column when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)

    render(
      await FamiliesPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByText('remaining')).toBeInTheDocument()
    expect(screen.getByText('Dupont')).toBeInTheDocument()
  })

  it('hides the settlement column when payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    render(
      await FamiliesPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.queryByText('remaining')).not.toBeInTheDocument()
    expect(screen.getByText('Dupont')).toBeInTheDocument()
  })

  it("attributes a shared-custody student's debt to the parent family only", async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    // Noa est rattaché à `family-1` (OTHER) et `family-2` (PARENT) : seule family-2 doit
    // voir son inscription de 300, family-1 reste à zéro.
    dbMock.family.findMany.mockResolvedValue([
      {
        id: 'family-1',
        name: 'Dupont',
        emergencyContactName: null,
        emergencyContactPhone: null,
        persons: [
          {
            person: {
              families: [
                { familyId: 'family-1', relationType: 'OTHER' as const },
                { familyId: 'family-2', relationType: 'PARENT' as const },
              ],
              student: {
                enrollments: [
                  {
                    id: 'shared-enrollment',
                    status: 'ACTIVE' as const,
                    totalAmount: 300,
                    discount: 0,
                    payments: [],
                    _count: { payments: 0 },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        id: 'family-2',
        name: 'Martin',
        emergencyContactName: null,
        emergencyContactPhone: null,
        persons: [
          {
            person: {
              families: [
                { familyId: 'family-1', relationType: 'OTHER' as const },
                { familyId: 'family-2', relationType: 'PARENT' as const },
              ],
              student: {
                enrollments: [
                  {
                    id: 'shared-enrollment',
                    status: 'ACTIVE' as const,
                    totalAmount: 300,
                    discount: 0,
                    payments: [],
                    _count: { payments: 0 },
                  },
                ],
              },
            },
          },
        ],
      },
    ])

    render(
      await FamiliesPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByText('Dupont')).toBeInTheDocument()
    expect(screen.getByText('Martin')).toBeInTheDocument()
    // Un seul "300" affiché : la dette n'apparaît que sur la fiche de family-2 (PARENT).
    expect(screen.getAllByText(/300/)).toHaveLength(1)
  })

  it('sums the paid total in the database and previews only the latest payments', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    // Six paiements de 40 sur une inscription de 250 : la base ne renvoie que les cinq
    // derniers et leur nombre, la somme (240) vient de `groupBy`, pas des lignes lues.
    const fixture = family('family-1', 'Dupont')
    const enrollment = fixture.persons[0].person.student.enrollments[0]
    enrollment.totalAmount = 250
    enrollment.payments = Array.from({ length: 5 }, (_, index) => ({
      amount: 40,
      method: 'CASH' as const,
      paidAt: new Date(`2026-01-0${index + 1}`),
      cashedAt: null,
    }))
    enrollment._count = { payments: 6 }
    dbMock.family.findMany.mockResolvedValue([fixture])
    dbMock.payment.groupBy.mockResolvedValue([
      { enrollmentId: 'family-1-enrollment', _sum: { amount: { toString: () => '240.00' } } },
    ])

    render(
      await FamiliesPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(dbMock.payment.groupBy).toHaveBeenCalledWith({
      by: ['enrollmentId'],
      where: { schoolId: 'school-1', isActive: true },
      _sum: { amount: true },
    })
    const enrollmentSelect =
      dbMock.family.findMany.mock.calls[0][0].select.persons.select.person.select.student.select
        .enrollments.select
    expect(enrollmentSelect.payments).toMatchObject({ where: { isActive: true }, take: 5 })
    expect(enrollmentSelect._count).toEqual({ select: { payments: { where: { isActive: true } } } })
    // Reste dû 250 - 240 = 10 €, affiché seul dans la colonne de règlement.
    expect(screen.getByText(/10,00/)).toBeInTheDocument()
  })
})
