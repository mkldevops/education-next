import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Family } from '@/generated/prisma/client'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { HeroBanner } = await import('./hero-banner')

const family = { id: 'family-1', name: 'Dupont', languagesAtHome: [] } as unknown as Family

describe('HeroBanner', () => {
  it('aligns actions to the right on narrow screens', async () => {
    const { container } = render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 1,
        paymentsEnabled: true,
        remainingBalance: 100,
        showActions: true,
      })
    )

    expect(container.firstElementChild?.lastElementChild).toHaveClass('self-end', 'md:self-auto')
    expect(container.firstElementChild?.lastElementChild).not.toHaveClass('self-start')
  })

  it('offers the pay quick action when payments are enabled and a balance is due', async () => {
    render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 1,
        paymentsEnabled: true,
        remainingBalance: 100,
        showActions: true,
      })
    )

    const payButton = screen.getByRole('button', { name: 'pay' })
    expect(payButton).toBeEnabled()
  })

  it('keeps the pay quick action visible but disabled when nothing is due', async () => {
    render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 1,
        paymentsEnabled: true,
        remainingBalance: 0,
        showActions: true,
      })
    )

    expect(screen.getByRole('button', { name: 'pay' })).toBeDisabled()
  })

  it('drops the pay quick action entirely when payments are disabled, even with a balance due', async () => {
    render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 1,
        paymentsEnabled: false,
        remainingBalance: 100,
        showActions: true,
      })
    )

    expect(screen.queryByRole('button', { name: 'pay' })).not.toBeInTheDocument()
  })
})
