import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OutstandingFamilyActions } from './outstanding-family-actions'

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.family ? [key, values.family, values.amount].filter(Boolean).join(':') : key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('../../../_lib/payment-actions', () => ({ recordPaymentAction: vi.fn() }))

const family = { id: 'family-1', name: 'Benali' }

describe('OutstandingFamilyActions', () => {
  it('dials the contact phone, stripped of its separators', () => {
    render(
      <OutstandingFamilyActions
        family={family}
        phone="06 12 34 56 78"
        overdueAmount="120 €"
        currency="EUR"
      />
    )

    const call = screen.getByRole('link', { name: 'callFamily:Benali' })
    expect(call).toHaveAttribute('href', 'tel:0612345678')
    expect(call).toHaveTextContent('06 12 34 56 78')
  })

  it('opens a WhatsApp conversation prefilled with the overdue amount', () => {
    render(
      <OutstandingFamilyActions
        family={family}
        phone="06 12 34 56 78"
        overdueAmount="120 €"
        currency="EUR"
      />
    )

    const whatsApp = screen.getByRole('link', { name: 'whatsAppFamily:Benali' })
    expect(whatsApp).toHaveAttribute(
      'href',
      `https://wa.me/33612345678?text=${encodeURIComponent('whatsAppMessage:Benali:120 €')}`
    )
    expect(whatsApp).toHaveAttribute('target', '_blank')
  })

  it('offers no WhatsApp link for a number it cannot place', () => {
    render(
      <OutstandingFamilyActions family={family} phone="612" overdueAmount="120 €" currency="EUR" />
    )

    expect(screen.getByRole('link', { name: 'callFamily:Benali' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'whatsAppFamily:Benali' })).not.toBeInTheDocument()
  })

  it('says so when the family has no phone', () => {
    render(
      <OutstandingFamilyActions family={family} phone={null} overdueAmount="120 €" currency="EUR" />
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('noPhone')).toBeInTheDocument()
  })

  it('opens the existing payment dialog already set on the family', () => {
    render(
      <OutstandingFamilyActions family={family} phone={null} overdueAmount="120 €" currency="EUR" />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'recordFor:Benali' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Benali')
    expect(screen.getByLabelText('amount')).toBeInTheDocument()
    expect(screen.queryByLabelText('selectFamily')).not.toBeInTheDocument()
    const familyInput = document.body.querySelector<HTMLInputElement>('input[name="familyId"]')
    expect(familyInput?.value).toBe('family-1')
  })
})
