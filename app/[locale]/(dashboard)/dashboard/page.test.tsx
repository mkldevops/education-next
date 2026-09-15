import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const schoolGatewayMock = { findActiveById: vi.fn() }
const authMock = { api: { getSession: vi.fn() } }
const getSchoolContextMock = vi.fn()
const requireSchoolScopeMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const isEventsEnabledMock = vi.fn()
const getDashboardOverviewMock = vi.fn()
const isStripeConfiguredMock = vi.fn(() => true)

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  setRequestLocale: () => {},
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: schoolGatewayMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/school-context', () => ({ getSchoolContext: getSchoolContextMock }))
vi.mock('@/lib/stripe', () => ({ isStripeConfigured: isStripeConfiguredMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/use-cases/events/is-events-enabled', () => ({
  isEventsEnabled: isEventsEnabledMock,
}))
vi.mock('../_lib/auth-helper', () => ({ requireSchoolScope: requireSchoolScopeMock }))
vi.mock('./_lib/dashboard-overview', () => ({ getDashboardOverview: getDashboardOverviewMock }))
// `SchoolInsightsSection` est un composant serveur asynchrone couvert par son propre test
// (`_components/school-insights.test.tsx`) ; le moteur de rendu client des tests ne sait
// pas résoudre un composant serveur imbriqué.
vi.mock('./_components/school-insights', () => ({
  SchoolInsightsSection: ({ insights }: { insights: { payments: unknown } }) => (
    <div data-testid="school-insights">{insights.payments ? 'has-stats' : 'no-stats'}</div>
  ),
}))
vi.mock('./families/[id]/_components/activate-enrollment-button', () => ({
  ActivateEnrollmentButton: () => <button type="button">activate-enrollment</button>,
}))
vi.mock('./families/[id]/_components/online-payment-button', () => ({
  OnlinePaymentButton: () => <button type="button">online-payment</button>,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: DashboardPage } = await import('./page')

const recentEnrollments = [
  {
    id: 'enrollment-1',
    status: 'ACTIVE' as const,
    totalAmount: 100,
    registeredAt: new Date('2026-01-10'),
    student: { id: 'student-1', person: { name: 'Alice', lastname: 'Dupont' } },
    plan: { name: 'Standard' },
    classAssignments: [],
    payments: [{ amount: 50 }],
  },
]

const overview = (paymentsEnabled: boolean, isAdmin: boolean) => ({
  selectedPeriod: null,
  familyCount: 3,
  studentCount: 4,
  enrollmentCount: 5,
  pendingPaymentCount: 1,
  recentEnrollments,
  parentBalance: isAdmin ? null : { remainingBalance: 75 },
  insights: isAdmin
    ? {
        payments: paymentsEnabled
          ? {
              totals: { remaining: 400, collected: 600, collectionRate: 60 },
              monthly: [],
              methods: [],
              families: [],
            }
          : null,
        classes: [],
        levels: [],
      }
    : null,
})

beforeEach(() => {
  vi.clearAllMocks()
  isStripeConfiguredMock.mockReturnValue(true)
  isEventsEnabledMock.mockResolvedValue(false)
  schoolGatewayMock.findActiveById.mockResolvedValue({ id: 'school-1', name: 'Al-Nour' })
  authMock.api.getSession.mockResolvedValue({ user: { name: 'Jane', email: 'jane@example.com' } })
})

describe('DashboardPage, admin', () => {
  beforeEach(() => {
    getSchoolContextMock.mockResolvedValue({
      role: 'ADMIN',
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })
    requireSchoolScopeMock.mockResolvedValue({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: true,
    })
  })

  it('hides the outstanding-balance card, the payment column and the collection stats when payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getDashboardOverviewMock.mockResolvedValue(overview(false, true))

    render(await DashboardPage({ params: Promise.resolve({ locale: 'fr' }) }))

    expect(screen.queryByText('insights.remaining')).not.toBeInTheDocument()
    expect(screen.queryByText('table.payment')).not.toBeInTheDocument()
    expect(screen.queryByText('table.plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Standard')).not.toBeInTheDocument()
    expect(screen.getByTestId('school-insights')).toHaveTextContent('no-stats')
    // Le reste du tableau de bord n'est pas affecté.
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument()
  })

  it('shows the outstanding-balance card, the payment column and the collection stats when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true, true))

    render(await DashboardPage({ params: Promise.resolve({ locale: 'fr' }) }))

    expect(screen.getByText('insights.remaining')).toBeInTheDocument()
    expect(screen.getByText('table.payment')).toBeInTheDocument()
    expect(screen.getByText('table.plan')).toBeInTheDocument()
    expect(screen.getByTestId('school-insights')).toHaveTextContent('has-stats')
  })
})

describe('DashboardPage, parent', () => {
  beforeEach(() => {
    getSchoolContextMock.mockResolvedValue({
      role: 'PARENT',
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: 'family-1',
    })
    requireSchoolScopeMock.mockResolvedValue({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
      familyId: 'family-1',
    })
  })

  it('hides the balance card and the online payment button when payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getDashboardOverviewMock.mockResolvedValue(overview(false, false))

    render(await DashboardPage({ params: Promise.resolve({ locale: 'fr' }) }))

    expect(screen.queryByText('stats.remainingBalance')).not.toBeInTheDocument()
    expect(screen.queryByText('online-payment')).not.toBeInTheDocument()
  })

  it('shows the balance card and the online payment button when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true, false))

    render(await DashboardPage({ params: Promise.resolve({ locale: 'fr' }) }))

    expect(screen.getByText('stats.remainingBalance')).toBeInTheDocument()
    expect(screen.getByText('online-payment')).toBeInTheDocument()
  })
})
