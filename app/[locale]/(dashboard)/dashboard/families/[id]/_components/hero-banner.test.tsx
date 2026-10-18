import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Family } from '@/generated/prisma/client'

// Les clés sans valeurs restent brutes (noms accessibles stables) ; celles qui reçoivent `count`
// passent par le vrai formateur ICU pour vérifier les pluriels du catalogue français.
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl')
  const { default: messages } = await import('../../../../../../../messages/fr.json')
  return {
    getTranslations: async (namespace: string) => {
      const translate = createTranslator({ locale: 'fr', messages, namespace } as never) as (
        key: string,
        values?: Record<string, unknown>
      ) => string
      return (key: string, values?: Record<string, unknown>) =>
        values && 'count' in values ? translate(key, values) : key
    },
  }
})
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
  it('pluralizes the family counts', async () => {
    render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 0,
        paymentsEnabled: false,
        remainingBalance: 0,
        showActions: false,
      })
    )

    expect(screen.getByText('2 membres')).toBeInTheDocument()
    expect(screen.getByText('1 enfant')).toBeInTheDocument()
    expect(screen.getByText('0 inscription')).toBeInTheDocument()
    expect(screen.queryByText(/Enfants/)).not.toBeInTheDocument()
  })

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

  it('keeps the payment as the only filled header button', async () => {
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

    expect(screen.getByRole('button', { name: 'pay' })).toHaveClass('bg-primary')
    expect(screen.getAllByRole('button', { name: 'newStudent' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'newStudent' })).not.toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'newStudent' })).toHaveClass('border')
  })

  it('fills the student action when the school does not manage payments', async () => {
    render(
      await HeroBanner({
        family,
        membersCount: 2,
        studentsCount: 1,
        enrollmentsCount: 1,
        paymentsEnabled: false,
        remainingBalance: 0,
        showActions: true,
      })
    )

    expect(screen.getByRole('button', { name: 'newStudent' })).toHaveClass('bg-primary')
  })
})
