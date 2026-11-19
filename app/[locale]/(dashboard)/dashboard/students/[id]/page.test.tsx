import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolSessionMock = vi.fn()
const canOpenSchoolCashierMock = vi.fn()
const deriveStudentDetailMock = vi.fn()
const studentState = { isActive: true }

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
  setRequestLocale: () => {},
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriodId: async () => null }))
vi.mock('@/lib/school-context', () => ({
  isActiveSchoolAdmin: (context: { roles: string[] }) => context.roles.includes('ADMIN'),
  hasActiveSchoolStaffAccess: async (context: { roles: string[] }) =>
    context.roles.includes('ADMIN'),
}))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'KMF' }),
}))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: async () => false }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({ isPaymentsEnabled: async () => true }))
vi.mock('../../../_components/school-switch-prompt', () => ({ SchoolSwitchPrompt: () => null }))
vi.mock('../../../_lib/auth-helper', () => ({
  requireSchoolSession: requireSchoolSessionMock,
  canOpenSchoolCashier: canOpenSchoolCashierMock,
}))
vi.mock('../../../_lib/class-options-loader', () => ({
  loadSuggestedLevels: async () => new Map(),
}))
vi.mock('../../../_lib/page-metadata', () => ({ deepLinkTitle: vi.fn() }))
vi.mock('../../../_lib/school-switch', () => ({ canSwitchSchool: async () => false }))
vi.mock('../../enrollments/_components/create-enrollment-dialog', () => ({
  CreateEnrollmentDialog: () => null,
}))
vi.mock('../_components/archive-student-dialog', () => ({
  ArchiveStudentDialog: () => <button type="button">archive</button>,
}))
vi.mock('../_components/reinstate-student-button', () => ({
  ReinstateStudentButton: () => <button type="button">reinstate</button>,
}))
vi.mock('../_components/edit-student-dialog', () => ({ EditStudentDialog: () => null }))
vi.mock('./_components/enrollment-list', () => ({ EnrollmentList: () => null }))
vi.mock('./_components/family-panel', () => ({ FamilyPanel: () => null }))
vi.mock('./_components/meal-panel', () => ({ MealPanel: () => null }))
vi.mock('./_components/payment-history', () => ({ PaymentHistory: () => null }))
vi.mock('./_lib/student-payment-history', () => ({ getStudentPaymentHistory: async () => [] }))
vi.mock('../../payments/_components/record-payment-dialog', () => ({
  RecordPaymentDialog: () => null,
}))
vi.mock('@/use-cases/payments/family-balance', () => ({ getFamilyBalance: async () => null }))
vi.mock('@/use-cases/payments/payable-enrollment-choices', () => ({
  listPayableEnrollmentChoices: async () => [],
}))
vi.mock('./_lib/student-detail', () => ({
  resolveStudent: async () => ({
    status: 'found',
    resource: {
      id: 'student-1',
      schoolId: 'school-1',
      isActive: studentState.isActive,
      person: { name: 'Léo', lastname: 'Martin', phoneNumbers: [] },
      enrollments: [],
    },
  }),
  getStudentDialogData: async () => ({ plans: [], classes: [] }),
  deriveStudentDetail: deriveStudentDetailMock,
}))

const { default: StudentDetailPage } = await import('./page')

const detail = (family: { id: string; isActive: boolean } | null) => ({
  fullName: 'Léo Martin',
  family,
  birthday: null,
  age: null,
  totalDue: 0,
  totalPaid: 0,
  remaining: 0,
  activeEnrollments: [],
  payableRemaining: 0,
  languagesAtHome: '',
  departedAt: null as Date | null,
})

const renderPage = async () =>
  render(
    await StudentDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'student-1' }) } as never)
  )

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({ roles: ['ADMIN'], schoolId: 'school-1' })
  canOpenSchoolCashierMock.mockResolvedValue(true)
  studentState.isActive = true
  deriveStudentDetailMock.mockReturnValue(detail({ id: 'family-1', isActive: true }))
})

describe('StudentDetailPage, cashier link', () => {
  it('opens the cashier on the debtor family, with or without a tuition balance', async () => {
    await renderPage()

    expect(screen.getByRole('link', { name: 'collectServices' })).toHaveAttribute(
      'href',
      '/dashboard/cashier?familyId=family-1'
    )
    expect(screen.queryByRole('link', { name: 'pay' })).not.toBeInTheDocument()
  })

  it('hides the link when the cashier guard refuses', async () => {
    canOpenSchoolCashierMock.mockResolvedValue(false)

    await renderPage()

    expect(screen.queryByRole('link', { name: 'collectServices' })).not.toBeInTheDocument()
  })

  it('hides the link for an archived family', async () => {
    deriveStudentDetailMock.mockReturnValue(detail({ id: 'family-1', isActive: false }))

    await renderPage()

    expect(screen.queryByRole('link', { name: 'collectServices' })).not.toBeInTheDocument()
  })

  it('never asks the cashier guard for a reader outside the staff', async () => {
    requireSchoolSessionMock.mockResolvedValue({ roles: ['PARENT'], schoolId: 'school-1' })

    await renderPage()

    expect(canOpenSchoolCashierMock).not.toHaveBeenCalled()
  })
})

describe('StudentDetailPage, archived student', () => {
  it('offers to archive an active student', async () => {
    await renderPage()

    expect(screen.getByRole('button', { name: 'archive' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reinstate' })).not.toBeInTheDocument()
  })

  it('badges the departure month and offers to reinstate instead of archiving', async () => {
    studentState.isActive = false
    deriveStudentDetailMock.mockReturnValue({
      ...detail({ id: 'family-1', isActive: true }),
      departedAt: new Date('2027-01-10T00:00:00.000Z'),
    })

    await renderPage()

    expect(screen.getByText('archivedBadge:janvier 2027')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reinstate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'archive' })).not.toBeInTheDocument()
  })
})
