import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const schoolGatewayMock = { findActiveById: vi.fn() }
const configGatewayMock = { get: vi.fn() }
const authMock = { api: { getSession: vi.fn() } }
const getSchoolContextMock = vi.fn()
const requireSchoolScopeMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const isEventsEnabledMock = vi.fn()
const isClassScheduleEnabledMock = vi.fn()
const getSelectedPeriodMock = vi.fn()
const getDashboardOverviewMock = vi.fn()
const getTodayAgendaMock = vi.fn()
const getParentHomeMock = vi.fn()
const isOnlinePaymentAvailableMock = vi.fn()
const isMealsEnabledMock = vi.fn()
const loadMealDuesMock = vi.fn()
const redirectMock = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  setRequestLocale: () => {},
}))
vi.mock('@/i18n/routing', () => ({
  redirect: redirectMock,
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: schoolGatewayMock }))
vi.mock('@/gateways/config-gateway', () => ({ configGateway: configGatewayMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/school-context', () => ({
  getSchoolContext: getSchoolContextMock,
  hasSchoolRole: (context: { isSuperAdmin: boolean; roles: string[] }, role: string) =>
    !context.isSuperAdmin && context.roles.includes(role),
  isActiveSchoolAdmin: (context: { isSuperAdmin: boolean; roles: string[] }) =>
    context.isSuperAdmin || context.roles.includes('ADMIN'),
}))
vi.mock('@/use-cases/payments/stripe-settings', () => ({
  isOnlinePaymentAvailable: isOnlinePaymentAvailableMock,
}))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/use-cases/events/is-events-enabled', () => ({
  isEventsEnabled: isEventsEnabledMock,
}))
vi.mock('@/use-cases/class-schedules/is-class-schedule-enabled', () => ({
  isClassScheduleEnabled: isClassScheduleEnabledMock,
}))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: isMealsEnabledMock }))
vi.mock('./cashier/_lib/debtors-data', () => ({ loadMealDues: loadMealDuesMock }))
vi.mock('./_components/collection-overview', () => ({
  CollectionOverview: ({
    payments,
    meals,
  }: {
    payments: unknown
    meals: { services: Array<{ service: string }> } | null
  }) => (
    <div data-testid="collection">
      {payments ? 'tuition' : 'no-tuition'}|
      {meals ? meals.services.map((entry) => entry.service).join(',') : 'no-meals'}
    </div>
  ),
}))
vi.mock('../_lib/auth-helper', () => ({ requireSchoolScope: requireSchoolScopeMock }))
vi.mock('./_lib/dashboard-overview', () => ({ getDashboardOverview: getDashboardOverviewMock }))
vi.mock('./_lib/today-agenda', () => ({ getTodayAgenda: getTodayAgendaMock }))
vi.mock('./_lib/parent-home', () => ({ getParentHome: getParentHomeMock }))
// Composants serveur asynchrones couverts par leurs propres tests : le moteur de rendu
// client des tests ne sait pas résoudre un composant serveur imbriqué.
vi.mock('./_components/school-insights', () => ({
  SchoolInsightsSection: ({ insights }: { insights: { payments: unknown } }) => (
    <div data-testid="school-insights">{insights.payments ? 'has-stats' : 'no-stats'}</div>
  ),
}))
vi.mock('./_components/unlinked-parent-notice', () => ({
  UnlinkedParentNotice: () => <div data-testid="unlinked-parent" />,
}))
vi.mock('./_components/upcoming-events-card', () => ({ UpcomingEventsCard: () => null }))
vi.mock('./families/[id]/_components/activate-enrollment-button', () => ({
  ActivateEnrollmentButton: () => <button type="button">activate-enrollment</button>,
}))
vi.mock('./families/[id]/_components/online-payment-button', () => ({
  OnlinePaymentButton: () => <button type="button">online-payment</button>,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: DashboardPage } = await import('./page')

const renderPage = async (locale = 'fr') =>
  render(await DashboardPage({ params: Promise.resolve({ locale }) }))

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

const totals = {
  due: 1000,
  collected: 600,
  remaining: 400,
  collectionRate: 60,
  enrollmentCount: 5,
  settledCount: 2,
  outstandingCount: 3,
  paymentCount: 4,
  uncashedAmount: 0,
  uncashedCount: 0,
}

const overview = (paymentsEnabled: boolean, pendingEnrollmentCount = 0) => ({
  selectedPeriod: { id: 'period-1', name: '2026-2027' },
  familyCount: 3,
  studentCount: 4,
  enrollmentCount: 5,
  pendingEnrollmentCount,
  recentEnrollments,
  insights: {
    payments: paymentsEnabled ? { totals, monthly: [], methods: [], families: [] } : null,
    classes: [],
  },
})

const adminContext = {
  roles: ['ADMIN'],
  isSuperAdmin: false,
  schoolId: 'school-1',
  userId: 'user-1',
  familyId: null,
}
const adminScope = { schoolId: 'school-1', userId: 'user-1', isAdmin: true }

beforeEach(() => {
  vi.clearAllMocks()
  isOnlinePaymentAvailableMock.mockResolvedValue(true)
  isEventsEnabledMock.mockResolvedValue(false)
  isMealsEnabledMock.mockResolvedValue(false)
  isClassScheduleEnabledMock.mockResolvedValue(false)
  configGatewayMock.get.mockResolvedValue(null)
  getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026-2027' })
  getTodayAgendaMock.mockResolvedValue(null)
  schoolGatewayMock.findActiveById.mockResolvedValue({ id: 'school-1', name: 'Al-Nour' })
  authMock.api.getSession.mockResolvedValue({ user: { name: 'Jane', email: 'jane@example.com' } })
})

describe('DashboardPage, admin', () => {
  beforeEach(() => {
    getSchoolContextMock.mockResolvedValue(adminContext)
    requireSchoolScopeMock.mockResolvedValue(adminScope)
  })

  it('reads the overview and the agenda for the scoped school only, never the parent home', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true))

    await renderPage()

    expect(getDashboardOverviewMock).toHaveBeenCalledWith('school-1', true)
    expect(getTodayAgendaMock).toHaveBeenCalledWith('school-1', {
      periodId: 'period-1',
      attendanceEnabled: false,
      scheduleEnabled: false,
    })
    expect(configGatewayMock.get.mock.calls[0][0]).toBe('school-1')
    expect(getParentHomeMock).not.toHaveBeenCalled()
  })

  it('hides the collection overview, payment column and stats when payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getDashboardOverviewMock.mockResolvedValue(overview(false))

    await renderPage()

    expect(screen.queryByTestId('collection')).not.toBeInTheDocument()
    expect(screen.queryByText('table.payment')).not.toBeInTheDocument()
    expect(screen.queryByText('table.plan')).not.toBeInTheDocument()
    expect(screen.getByTestId('school-insights')).toHaveTextContent('no-stats')
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument()
  })

  it('shows the collection overview, payment column and stats when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true))

    await renderPage()

    expect(screen.getByTestId('collection')).toHaveTextContent('tuition|no-meals')
    expect(screen.getByText('table.payment')).toBeInTheDocument()
    expect(screen.getByText('table.plan')).toBeInTheDocument()
    expect(screen.getByTestId('school-insights')).toHaveTextContent('has-stats')
  })

  it('lists the attendance and pending enrollment tasks and today classes', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    isClassScheduleEnabledMock.mockResolvedValue(true)
    configGatewayMock.get.mockResolvedValue({ value: 'true' })
    getDashboardOverviewMock.mockResolvedValue(overview(false, 2))
    getTodayAgendaMock.mockResolvedValue({
      closed: false,
      attendanceToTake: 1,
      classes: [
        {
          slotId: 'slot-1',
          classPeriodId: 'class-1',
          className: 'CP A',
          startTime: '09:00',
          endTime: '11:00',
          teachers: ['Awa Diallo'],
          attendance: 'NOT_STARTED',
        },
      ],
    })

    await renderPage()

    expect(getTodayAgendaMock).toHaveBeenCalledWith('school-1', {
      periodId: 'period-1',
      attendanceEnabled: true,
      scheduleEnabled: true,
    })
    expect(screen.getByText('home.todo.attendance:{"count":1}')).toBeInTheDocument()
    expect(screen.getByText('home.todo.pendingEnrollments:{"count":2}')).toBeInTheDocument()
    expect(screen.getByText('home.schedule.title')).toBeInTheDocument()
    expect(screen.getByText('CP A')).toBeInTheDocument()
    expect(screen.getByText('notStarted')).toBeInTheDocument()
  })

  it('leaves meals out of the home when the school does not serve them', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true))

    await renderPage()

    expect(loadMealDuesMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('collection')).toHaveTextContent('no-meals')
    expect(screen.queryByText(/home\.todo\.meals/)).not.toBeInTheDocument()
  })

  it('shows canteen and snack dues in the collection overview and their follow-up task', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    isMealsEnabledMock.mockResolvedValue(true)
    getDashboardOverviewMock.mockResolvedValue(overview(true))
    loadMealDuesMock.mockResolvedValue({
      services: [
        { service: 'CANTEEN', subscribed: 10, upToDate: 4, overdue: 6, dueAmount: 300 },
        { service: 'SNACK', subscribed: 5, upToDate: 5, overdue: 0, dueAmount: 0 },
      ],
      toRemind: 7,
      dueAmount: 300,
    })

    await renderPage()

    expect(loadMealDuesMock.mock.calls[0][0]).toBe('school-1')
    expect(screen.getByTestId('collection')).toHaveTextContent('tuition|CANTEEN,SNACK')
    expect(screen.getByText('home.todo.meals:{"count":7}')).toBeInTheDocument()
    expect(screen.getByText('stats.families')).toBeInTheDocument()
  })

  it('shows the empty to-do state when nothing is pending', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getDashboardOverviewMock.mockResolvedValue(overview(false))

    await renderPage()

    expect(screen.getByText('home.todo.empty')).toBeInTheDocument()
    expect(screen.queryByText('home.schedule.title')).not.toBeInTheDocument()
  })
})

describe('DashboardPage, parent', () => {
  const parentHome = (remainingBalance: number | null) => ({
    children: [
      {
        id: 'student-1',
        firstName: 'Amine',
        lastName: 'Benali',
        className: 'CE1 B',
        levelName: 'CE1',
        nextClass: null,
      },
    ],
    remainingBalance,
  })

  beforeEach(() => {
    getSchoolContextMock.mockResolvedValue({
      roles: ['PARENT'],
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

  it('reads the home of the linked family only, never the school overview', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    isClassScheduleEnabledMock.mockResolvedValue(true)
    getParentHomeMock.mockResolvedValue(parentHome(75))

    await renderPage()

    expect(getParentHomeMock).toHaveBeenCalledWith('school-1', 'family-1', {
      periodId: 'period-1',
      paymentsEnabled: true,
      scheduleEnabled: true,
    })
    expect(getDashboardOverviewMock).not.toHaveBeenCalled()
    expect(getTodayAgendaMock).not.toHaveBeenCalled()
    expect(screen.getByText('Amine Benali')).toBeInTheDocument()
    expect(screen.getByText('CE1 B')).toBeInTheDocument()
    expect(screen.getByText('home.children.noNextClass')).toBeInTheDocument()
  })

  it('hides the balance card and the online payment button when payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getParentHomeMock.mockResolvedValue(parentHome(null))

    await renderPage()

    expect(screen.queryByText('stats.remainingBalance')).not.toBeInTheDocument()
    expect(screen.queryByText('online-payment')).not.toBeInTheDocument()
  })

  it('shows the balance card and the online payment button when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getParentHomeMock.mockResolvedValue(parentHome(75))

    await renderPage()

    expect(screen.getByText('stats.remainingBalance')).toBeInTheDocument()
    expect(screen.getByText('online-payment')).toBeInTheDocument()
  })

  it('shows the empty state when no child is linked', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)
    getParentHomeMock.mockResolvedValue({ children: [], remainingBalance: null })

    await renderPage()

    expect(screen.getByText('home.children.empty')).toBeInTheDocument()
  })

  it('denies an unlinked parent before any family or school read', async () => {
    getSchoolContextMock.mockResolvedValue({
      roles: ['PARENT'],
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })

    await renderPage()

    expect(screen.getByTestId('unlinked-parent')).toBeInTheDocument()
    expect(requireSchoolScopeMock).not.toHaveBeenCalled()
    expect(getParentHomeMock).not.toHaveBeenCalled()
    expect(getDashboardOverviewMock).not.toHaveBeenCalled()
  })
})

describe('DashboardPage, teacher-only membership', () => {
  beforeEach(() => {
    getSchoolContextMock.mockResolvedValue({
      roles: ['TEACHER'],
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })
  })

  it.each(['fr', 'en'])('redirects %s to My classes before dashboard reads', async (locale) => {
    const redirectSignal = new Error('teacher dashboard redirect')
    redirectMock.mockImplementationOnce(() => {
      throw redirectSignal
    })

    await expect(DashboardPage({ params: Promise.resolve({ locale }) })).rejects.toBe(
      redirectSignal
    )

    expect(redirectMock).toHaveBeenCalledWith({ href: '/dashboard/my-classes', locale })
    expect(requireSchoolScopeMock).not.toHaveBeenCalled()
    expect(isPaymentsEnabledMock).not.toHaveBeenCalled()
    expect(isEventsEnabledMock).not.toHaveBeenCalled()
    expect(getDashboardOverviewMock).not.toHaveBeenCalled()
    expect(getParentHomeMock).not.toHaveBeenCalled()
    expect(schoolGatewayMock.findActiveById).not.toHaveBeenCalled()
  })

  it('keeps the administrative dashboard for a super-admin', async () => {
    getSchoolContextMock.mockResolvedValue({
      roles: [],
      isSuperAdmin: true,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })
    requireSchoolScopeMock.mockResolvedValue(adminScope)
    isPaymentsEnabledMock.mockResolvedValue(false)
    getDashboardOverviewMock.mockResolvedValue(overview(false))

    await DashboardPage({ params: Promise.resolve({ locale: 'fr' }) })

    expect(redirectMock).not.toHaveBeenCalled()
    expect(requireSchoolScopeMock).toHaveBeenCalledOnce()
  })
})

describe('DashboardPage, cashier membership', () => {
  it.each([
    [['CASHIER'], '/dashboard/cashier'],
    [['CASHIER', 'PARENT'], '/dashboard/cashier'],
    [['CASHIER', 'TEACHER'], '/dashboard/my-classes'],
  ])('sends %j without a linked family to %s before dashboard reads', async (roles, href) => {
    getSchoolContextMock.mockResolvedValue({
      roles,
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })
    const redirectSignal = new Error('cashier dashboard redirect')
    redirectMock.mockImplementationOnce(() => {
      throw redirectSignal
    })

    await expect(DashboardPage({ params: Promise.resolve({ locale: 'fr' }) })).rejects.toBe(
      redirectSignal
    )

    expect(redirectMock).toHaveBeenCalledWith({ href, locale: 'fr' })
    expect(requireSchoolScopeMock).not.toHaveBeenCalled()
    expect(getDashboardOverviewMock).not.toHaveBeenCalled()
  })
})
