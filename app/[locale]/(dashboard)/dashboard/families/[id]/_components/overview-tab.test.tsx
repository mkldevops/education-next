import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))
// `OnlinePaymentButton` tire `@/i18n/routing`, qui charge `next-intl/navigation` — non
// résolu par Node hors du bundler Next — et l'action serveur d'ouverture de paiement.
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('../../../../_lib/online-payment-actions', () => ({
  createOnlinePaymentAction: vi.fn(),
}))
// `ParentsSection` est un composant serveur asynchrone sans rapport avec l'argent ; le
// moteur de rendu client des tests ne sait pas résoudre un composant serveur imbriqué.
vi.mock('./parents-section', () => ({
  ParentsSection: () => <div data-testid="parents-section" />,
}))

vi.mock('./children-summary', () => ({
  ChildrenSummary: () => <div data-testid="children-summary" />,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { OverviewTab } = await import('./overview-tab')

const baseProps = {
  locale: 'fr',
  familyId: 'family-1',
  isAdmin: false,
  canInvite: false,
  persons: [],
  students: [],
  linkedEmails: [],
  enrolledChildren: 2,
  totalEnrollments: 3,
  activeEnrollments: 2,
  canAddEnrollment: true,
  onlinePaymentAvailable: true,
  totalPaid: 100,
  remainingBalance: 50,
  totalDue: 150,
  totalDiscount: 0,
}

describe('OverviewTab', () => {
  it('offers enrollment creation to administrators without repeating the header student action', async () => {
    render(await OverviewTab({ ...baseProps, isAdmin: true, paymentsEnabled: true }))

    expect(screen.queryByRole('link', { name: 'actions.newStudent' })).not.toBeInTheDocument()
    expect(screen.getByText('sections.childrenTitle')).toBeInTheDocument()
    expect(screen.getByTestId('children-summary')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'actions.addEnrollment' })).toHaveAttribute(
      'href',
      '/dashboard/families/family-1?action=addEnrollment'
    )
  })

  it('hides enrollment creation when no student needs one', async () => {
    render(
      await OverviewTab({
        ...baseProps,
        isAdmin: true,
        canAddEnrollment: false,
        paymentsEnabled: true,
      })
    )

    expect(screen.queryByRole('link', { name: 'actions.addEnrollment' })).not.toBeInTheDocument()
  })

  it('shows the financial summary and online payment button when payments are enabled', async () => {
    render(await OverviewTab({ ...baseProps, paymentsEnabled: true }))

    expect(screen.getByText('sections.financialTitle')).toBeInTheDocument()
    expect(screen.getByText('kpis.totalPaid')).toBeInTheDocument()
    expect(screen.getByText('kpis.remainingBalance')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('hides the financial summary, money KPIs and online payment button when payments are disabled', async () => {
    render(await OverviewTab({ ...baseProps, paymentsEnabled: false }))

    expect(screen.queryByText('sections.financialTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('kpis.totalPaid')).not.toBeInTheDocument()
    expect(screen.queryByText('kpis.remainingBalance')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Les statistiques non monétaires restent affichées.
    expect(screen.getByText('kpis.enrolledChildren')).toBeInTheDocument()
    expect(screen.getByText('sections.parentsTitle')).toBeInTheDocument()
  })
})
