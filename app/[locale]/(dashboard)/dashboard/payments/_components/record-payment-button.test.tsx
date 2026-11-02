import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecordPaymentButton } from './record-payment-button'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace }),
}))
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

  it('states the tuition scope and offers the cashier of the picked family when allowed', () => {
    render(
      <RecordPaymentButton
        families={[{ id: 'family-1', name: 'Benali' }]}
        currency="EUR"
        canOpenCashier
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    fireEvent.click(screen.getByRole('button', { name: 'Benali' }))

    expect(screen.getByText('scopeHint')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'servicesLink' })).toHaveAttribute(
      'href',
      '/dashboard/cashier?familyId=family-1'
    )
  })

  it('keeps the tuition scope without a cashier link when it is not allowed', () => {
    render(<RecordPaymentButton families={[{ id: 'family-1', name: 'Benali' }]} currency="EUR" />)

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    fireEvent.click(screen.getByRole('button', { name: 'Benali' }))

    expect(screen.getByText('scopeHint')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
