import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('SchoolInsightsSection', () => {
  it('lists the class fill rates', async () => {
    render(
      await SchoolInsightsSection({
        classes: [{ id: 'class-1', name: 'CP-A', level: 'CP', enrolled: 18, capacity: 20 }],
      })
    )

    expect(screen.getByText('classFillTitle')).toBeInTheDocument()
    expect(screen.getByText('CP-A')).toBeInTheDocument()
    expect(screen.queryByText('collectionTitle')).not.toBeInTheDocument()
  })

  it('says so when the period has no class', async () => {
    render(await SchoolInsightsSection({ classes: [] }))

    expect(screen.getByText('noClasses')).toBeInTheDocument()
  })
})
