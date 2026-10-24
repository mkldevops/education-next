import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecordPaymentButton } from './record-payment-button'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }))
vi.mock('../../../_lib/payment-actions', () => ({ recordPaymentAction: vi.fn() }))

describe('RecordPaymentButton', () => {
  it('opens the existing payment dialog for the family picked first', () => {
    render(
      <RecordPaymentButton
        families={[
          { id: 'family-1', name: 'Benali' },
          { id: 'family-2', name: 'Durand' },
        ]}
        currency="EUR"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    fireEvent.click(screen.getByRole('button', { name: 'Benali' }))

    expect(screen.getByLabelText('amount')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Benali')
    const familyInput = document.body.querySelector<HTMLInputElement>('input[name="familyId"]')
    expect(familyInput?.value).toBe('family-1')
    expect(replace).toHaveBeenCalledWith('/dashboard/payments', { scroll: false })
  })
})
