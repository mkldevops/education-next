import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolSessionMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const getFamilyBalanceMock = vi.fn()
const getFamilyPaymentTrackingMock = vi.fn()
const getSelectedPeriodIdMock = vi.fn()
const countDeletionImpactMock = vi.fn()
const resolveFamilyMock = vi.fn()
const getFamilyDialogDataMock = vi.fn()
const heroBannerMock = vi.fn()
const overviewTabMock = vi.fn()
const paymentsTabMock = vi.fn()
const recordPaymentActionMock = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriodId: getSelectedPeriodIdMock }))
vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: {
    countDeletionImpact: countDeletionImpactMock,
    list: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/lib/school-context', () => ({
  isActiveSchoolAdmin: (context: { roles: string[] }) => context.roles.includes('ADMIN'),
  hasActiveSchoolStaffAccess: async (context: { roles: string[]; staffTeacher?: boolean }) =>
    context.roles.includes('ADMIN') || context.staffTeacher === true,
}))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/use-cases/payments/family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))
vi.mock('@/use-cases/payments/payment-tracking', () => ({
  getFamilyPaymentTracking: getFamilyPaymentTrackingMock,
}))
vi.mock('../../../_components/school-switch-prompt', () => ({
  SchoolSwitchPrompt: () => <div data-testid="school-switch-prompt" />,
}))
vi.mock('../../../_lib/auth-helper', () => ({
  requireSchoolSession: requireSchoolSessionMock,
}))
vi.mock('../../../_lib/school-switch', () => ({ canSwitchSchool: async () => false }))
// `deriveFamilyDetail` reste réel : c'est une pure fonction de dérivation, pas une
// lecture ; seuls les points d'entrée de données (résolution, plans/classes) sont simulés.
vi.mock('./_lib/family-detail', async () => {
  const actual =
    await vi.importActual<typeof import('./_lib/family-detail')>('./_lib/family-detail')
  return {
    ...actual,
    resolveFamily: resolveFamilyMock,
    getFamilyDialogData: getFamilyDialogDataMock,
  }
})
// Composants gérés par leurs propres tests (`hero-banner.test.tsx`, `overview-tab.test.tsx`) ;
// simulés ici pour ne vérifier que le câblage de la page (montage, prop `paymentsEnabled`).
// `HeroBanner` doit tout de même rendre ses enfants : les dialogues d'administration,
// dont `RecordPaymentDialog`, sont montés comme enfants du vrai composant en production.
vi.mock('./_components/hero-banner', () => ({
  HeroBanner: (props: { paymentsEnabled: boolean; children?: React.ReactNode }) => {
    heroBannerMock(props)
    return <div data-testid="hero-banner">{props.children}</div>
  },
}))
vi.mock('./_components/overview-tab', () => ({
  OverviewTab: (props: { paymentsEnabled: boolean }) => {
    overviewTabMock(props)
    return <div data-testid="overview-tab" />
  },
}))
vi.mock('./_components/children-tab', () => ({
  ChildrenTab: () => <div data-testid="children-tab" />,
}))
vi.mock('./_components/activity-tab', () => ({
  ActivityTab: () => <div data-testid="activity-tab" />,
}))
vi.mock('./_components/payments-tab', () => ({
  PaymentsTab: (props: unknown) => {
    paymentsTabMock(props)
    return <div data-testid="payments-tab" />
  },
}))
vi.mock('../../enrollments/_components/create-enrollment-dialog', () => ({
  CreateEnrollmentDialog: () => null,
}))
vi.mock('../../students/_components/create-student-dialog', () => ({
  CreateStudentDialog: () => null,
}))
vi.mock('../_components/deactivate-family-button', () => ({
  DeactivateFamilyButton: () => null,
}))
vi.mock('../_components/delete-family-dialog', () => ({ DeleteFamilyDialog: () => null }))
vi.mock('../_components/edit-family-dialog', () => ({ EditFamilyDialog: () => null }))
// `RecordPaymentDialog` reste réel : c'est la surface à vérifier absente/présente.
vi.mock('../../../_lib/payment-actions', () => ({ recordPaymentAction: recordPaymentActionMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: FamilyDetailPage } = await import('./page')

const familyFixture = {
  status: 'found' as const,
  resource: {
    id: 'family-1',
    schoolId: 'school-1',
    name: 'Dupont',
    emergencyContactName: null,
    emergencyContactPhone: null,
    authorizedPickup: null,
    languagesAtHome: null,
    persons: [],
    users: [],
    payments: [],
  },
}

const balanceFixture = {
  enrollments: [],
  totalAmount: 200,
  totalDiscount: 0,
  totalPaid: 120,
  remainingBalance: 80,
  remainingAmountInCents: 8000,
}

const trackingFixture = {
  expectedToDate: 150,
  paidToDate: 120,
  overdueAmount: 30,
  tracked: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({
    roles: ['ADMIN'],
    isSuperAdmin: false,
    schoolId: 'school-1',
    userId: 'user-1',
    familyId: null,
  })
  resolveFamilyMock.mockResolvedValue(familyFixture)
  getFamilyDialogDataMock.mockResolvedValue({ plans: [], classes: [] })
  getFamilyBalanceMock.mockResolvedValue(balanceFixture)
  getFamilyPaymentTrackingMock.mockResolvedValue(trackingFixture)
  getSelectedPeriodIdMock.mockResolvedValue(null)
  countDeletionImpactMock.mockResolvedValue(null)
})

describe('FamilyDetailPage, payments enabled', () => {
  beforeEach(() => {
    isPaymentsEnabledMock.mockResolvedValue(true)
  })

  it('keeps the merge dialog mounted when its action URL is cleaned', async () => {
    const view = render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ action: 'mergeFamily' }),
      })
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    view.rerender(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({}),
      })
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('lists the payments tab and threads paymentsEnabled to the banner and overview', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({}),
      })
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'tabs.overview',
      'tabs.children',
      'tabs.payments',
      'tabs.activity',
    ])
    expect(heroBannerMock).toHaveBeenCalledWith(expect.objectContaining({ paymentsEnabled: true }))
    expect(overviewTabMock).toHaveBeenCalledWith(expect.objectContaining({ paymentsEnabled: true }))
    expect(getFamilyPaymentTrackingMock).toHaveBeenCalledWith('school-1', 'family-1')
  })

  it('passes date-based tracking separately from the annual balance to the payments tab', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ tab: 'payments' }),
      })
    )

    expect(paymentsTabMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tracking: trackingFixture,
        currency: 'EUR',
      })
    )
  })

  it('mounts the record-payment dialog opened by ?action=addPayment', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ action: 'addPayment' }),
      })
    )

    expect(document.querySelector('input[name="amount"]')).not.toBeNull()
  })
})

describe('FamilyDetailPage, payments disabled', () => {
  beforeEach(() => {
    isPaymentsEnabledMock.mockResolvedValue(false)
  })

  it('drops the payments tab and falls back to the default tab for an unknown ?tab=payments', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ tab: 'payments' }),
      })
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'tabs.overview',
      'tabs.children',
      'tabs.activity',
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(heroBannerMock).toHaveBeenCalledWith(expect.objectContaining({ paymentsEnabled: false }))
    expect(overviewTabMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentsEnabled: false })
    )
    expect(getFamilyPaymentTrackingMock).not.toHaveBeenCalled()
  })

  it('never mounts the record-payment dialog, even opened by ?action=addPayment', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ action: 'addPayment' }),
      })
    )

    expect(document.querySelector('input[name="amount"]')).toBeNull()
    expect(recordPaymentActionMock).not.toHaveBeenCalled()
    expect(getFamilyPaymentTrackingMock).not.toHaveBeenCalled()
  })
})

describe('FamilyDetailPage, teacher with extended access', () => {
  beforeEach(() => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    requireSchoolSessionMock.mockResolvedValue({
      roles: ['TEACHER'],
      staffTeacher: true,
      isSuperAdmin: false,
      schoolId: 'school-1',
      userId: 'user-1',
      familyId: null,
    })
  })

  it('manages the family without payments, deletion or parent invitation', async () => {
    render(
      await FamilyDetailPage({
        params: Promise.resolve({ locale: 'fr', id: 'family-1' }),
        searchParams: Promise.resolve({ action: 'addPayment' }),
      })
    )

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'tabs.overview',
      'tabs.children',
      'tabs.activity',
    ])
    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
    expect(getFamilyPaymentTrackingMock).not.toHaveBeenCalled()
    expect(countDeletionImpactMock).not.toHaveBeenCalled()
    expect(document.querySelector('input[name="amount"]')).toBeNull()
    expect(heroBannerMock).toHaveBeenCalledWith(
      expect.objectContaining({ showActions: true, canDelete: false, paymentsEnabled: false })
    )
    expect(overviewTabMock).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: true, canInvite: false, onlinePaymentAvailable: false })
    )
  })
})
