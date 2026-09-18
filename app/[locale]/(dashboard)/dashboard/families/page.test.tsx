import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  family: { findMany: vi.fn() },
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
})
