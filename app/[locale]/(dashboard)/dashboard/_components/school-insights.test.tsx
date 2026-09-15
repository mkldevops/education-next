import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SchoolInsights } from '../_lib/school-insights'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { SchoolInsightsSection } = await import('./school-insights')

const baseInsights: SchoolInsights = {
  payments: {
    totals: {
      due: 1000,
      collected: 600,
      remaining: 400,
      collectionRate: 60,
      enrollmentCount: 10,
      settledCount: 4,
      outstandingCount: 6,
      paymentCount: 8,
      uncashedAmount: 0,
      uncashedCount: 0,
    },
    monthly: [{ month: '2026-01', amount: 600, count: 8 }],
    methods: [{ method: 'CASH', amount: 600, count: 8, share: 100 }],
    families: [],
  },
  classes: [{ id: 'class-1', name: 'CP-A', level: 'CP', enrolled: 18, capacity: 20 }],
  levels: [{ level: 'CP', enrolled: 18 }],
}

describe('SchoolInsightsSection', () => {
  it('renders the collection card when payment stats are present', async () => {
    render(await SchoolInsightsSection({ insights: baseInsights, locale: 'fr' }))

    expect(screen.getByText('collectionTitle')).toBeInTheDocument()
    expect(screen.getByText('classFillTitle')).toBeInTheDocument()
  })

  it('hides the collection card but keeps class insights when payment stats are absent', async () => {
    render(
      await SchoolInsightsSection({
        insights: { ...baseInsights, payments: null },
        locale: 'fr',
      })
    )

    expect(screen.queryByText('collectionTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('viewPayments')).not.toBeInTheDocument()
    expect(screen.getByText('classFillTitle')).toBeInTheDocument()
    expect(screen.getByText('levelsTitle')).toBeInTheDocument()
  })
})
