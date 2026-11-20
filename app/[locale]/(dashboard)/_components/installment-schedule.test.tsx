import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallmentSchedule } from './installment-schedule'

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
// Le barrel `@peaklab/ui` importe la navigation localisée, hors de portée de ce test de rendu.
vi.mock('@/i18n/routing', () => ({ Link: () => null, usePathname: () => '/' }))

const installments = [
  { dueDate: '2026-11-05', amount: 50 },
  { dueDate: '2026-12-05', amount: 100 },
  { dueDate: '2027-01-05', amount: 100 },
]

const text = (element: HTMLElement) => element.textContent?.replace(/\s/g, ' ') ?? ''

describe('InstallmentSchedule', () => {
  it('lists each installment with its amount and the total', () => {
    render(<InstallmentSchedule installments={installments} currency="EUR" />)

    const rows = screen.getAllByRole('row')
    expect(text(rows[1])).toContain('novembre 2026')
    expect(text(rows[1])).toContain('50,00 €')
    expect(text(rows[3])).toContain('janvier 2027')
    expect(text(rows[4])).toContain('total')
    expect(text(rows[4])).toContain('250,00 €')
  })

  it('shows the day when two installments fall in the same month', () => {
    render(
      <InstallmentSchedule
        installments={[
          { dueDate: '2026-11-05', amount: 50 },
          { dueDate: '2026-11-20', amount: 50 },
        ]}
        currency="EUR"
      />
    )

    expect(screen.getByText('5 novembre 2026')).toBeInTheDocument()
    expect(screen.getByText('20 novembre 2026')).toBeInTheDocument()
  })

  it('adds the amounts of installments clamped to the same day', () => {
    render(
      <InstallmentSchedule
        installments={[
          { dueDate: '2027-02-28', amount: 50 },
          { dueDate: '2027-02-28', amount: 50 },
        ]}
        currency="EUR"
      />
    )

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(text(rows[1])).toContain('100,00 €')
    expect(text(rows[2])).toContain('100,00 €')
  })

  it('renders the schedule before and after a change', () => {
    render(
      <InstallmentSchedule
        previous={[
          { dueDate: '2026-10-05', amount: 100 },
          { dueDate: '2026-11-05', amount: 100 },
          { dueDate: '2026-12-05', amount: 100 },
          { dueDate: '2027-01-05', amount: 100 },
        ]}
        installments={installments}
        currency="EUR"
      />
    )

    const rows = screen.getAllByRole('row')
    expect(text(rows[1])).toContain('octobre 2026')
    expect(text(rows[1])).toContain('100,00 €')
    expect(within(rows[1]).getAllByText('none')).toHaveLength(1)
    expect(text(rows[2])).toMatch(/100,00 €.*50,00 €/)
    expect(within(rows[3]).queryByText('becomes')).not.toBeInTheDocument()
    expect(text(rows[5])).toMatch(/400,00 €.*250,00 €/)
  })

  it('shows the enrollment totals when one side has no schedule to add up', () => {
    render(
      <InstallmentSchedule
        previous={[]}
        installments={installments}
        previousTotal={400}
        total={250}
        currency="EUR"
      />
    )

    expect(text(screen.getAllByRole('row')[4])).toMatch(/400,00 €.*250,00 €/)
  })

  it('edits the first line and offers half and quarter of the nominal amount', () => {
    const onChange = vi.fn()
    render(
      <InstallmentSchedule
        installments={installments}
        currency="EUR"
        firstInstallment={{
          id: 'first',
          label: 'Montant de ce mois',
          value: '',
          nominal: 100,
          onChange,
        }}
      />
    )

    const input = screen.getByLabelText('Montant de ce mois')
    expect(input).toHaveAttribute('placeholder', '50')
    expect(input).toHaveAttribute('max', '100')

    fireEvent.change(input, { target: { value: '30' } })
    expect(onChange).toHaveBeenLastCalledWith('30')

    fireEvent.click(screen.getByRole('button', { name: 'half' }))
    expect(onChange).toHaveBeenLastCalledWith('50')

    fireEvent.click(screen.getByRole('button', { name: 'quarter' }))
    expect(onChange).toHaveBeenLastCalledWith('25')
  })

  it('rounds the shortcuts to the currency precision', () => {
    const onChange = vi.fn()
    render(
      <InstallmentSchedule
        installments={[{ dueDate: '2026-11-05', amount: 2500 }]}
        currency="KMF"
        firstInstallment={{ id: 'first', label: 'first', value: '', nominal: 2501, onChange }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'quarter' }))
    expect(onChange).toHaveBeenLastCalledWith('625')
  })
})
