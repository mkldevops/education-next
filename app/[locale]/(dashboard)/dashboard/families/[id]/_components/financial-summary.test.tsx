import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FinancialSummary } from './financial-summary'

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))

describe('FinancialSummary', () => {
  it('renders the progress arc with the success token instead of a hardcoded hex color', () => {
    const { container } = render(
      <FinancialSummary
        totalDue={100}
        totalPaid={50}
        totalDiscount={0}
        remainingBalance={50}
        currency="EUR"
      />
    )

    const circles = container.querySelectorAll('circle')
    const progressArc = circles[1]

    expect(progressArc).toHaveAttribute('stroke', 'var(--color-success)')
    expect(container.innerHTML).not.toContain('#10b981')
  })
})
