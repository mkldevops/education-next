import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentSchedule } from '@/domain/payment-schedule'
import { EnrollmentArrivalFields, useEnrollmentArrival } from './enrollment-arrival-fields'

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
// Le barrel `@peaklab/ui` importe la navigation localisée, hors de portée de ce test de rendu.
vi.mock('@/i18n/routing', () => ({ Link: () => null, usePathname: () => '/' }))

const monthly: PaymentSchedule = { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 }
const quarterly: PaymentSchedule = { mode: 'QUARTERLY', firstMonth: 9, count: 3, dueDay: 1 }
const period = { startAt: '2026-09-01T00:00:00.000Z', endAt: '2027-06-30T00:00:00.000Z' }

function Harness({ paymentSchedule = monthly }: { paymentSchedule?: PaymentSchedule }) {
  const arrival = useEnrollmentArrival(
    { id: 'plan-1', name: 'Forfait', amount: 1000, paymentSchedule },
    period,
    'EUR'
  )
  return (
    <>
      <EnrollmentArrivalFields
        idPrefix="test"
        schedule={arrival.schedule}
        currency="EUR"
        firstAmount={arrival.firstAmount}
        onStartMonthChange={arrival.changeStartMonth}
        onFirstAmountChange={arrival.changeFirstAmount}
      />
      <output data-testid="total">{arrival.totalAmount}</output>
      <output data-testid="input">{JSON.stringify(arrival.input)}</output>
    </>
  )
}

async function chooseMonth(name: RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: 'startMonth' }))
  const option = await screen.findByRole('option', { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe('EnrollmentArrivalFields', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays folded before the first due date of the plan', () => {
    vi.setSystemTime(new Date(2026, 7, 20, 10))
    const { container } = render(<Harness />)

    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.queryByRole('group', { name: 'title' })).not.toBeInTheDocument()
    expect(screen.getByTestId('input')).toHaveTextContent(
      '{"startMonth":null,"firstInstallmentAmount":null}'
    )
  })

  it('is shown unfolded once the first due date has passed', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    const { container } = render(<Harness />)

    const section = screen.getByRole('group', { name: 'title' })
    expect(container.querySelector('details')).toBeNull()
    expect(within(section).getByRole('combobox', { name: 'startMonth' })).toBeInTheDocument()
    expect(within(section).getByLabelText('firstAmount')).toBeInTheDocument()
    // En-tête, dix échéances, total.
    expect(within(section).getAllByRole('row')).toHaveLength(12)
  })

  it('owes from the chosen month and replaces its installment with the typed amount', async () => {
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    render(<Harness />)

    await chooseMonth(/Novembre 2026/)
    expect(screen.getAllByRole('row')).toHaveLength(10)
    expect(screen.getByTestId('total')).toHaveTextContent('800')
    expect(screen.getByTestId('input')).toHaveTextContent(
      '{"startMonth":"2026-11","firstInstallmentAmount":null}'
    )

    fireEvent.click(screen.getByRole('button', { name: 'half' }))
    expect(screen.getByLabelText('firstAmount')).toHaveValue(50)
    expect(screen.getByTestId('total')).toHaveTextContent('750')
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent(/total.*750,00/)
    expect(screen.getByTestId('input')).toHaveTextContent(
      '{"startMonth":"2026-11","firstInstallmentAmount":50}'
    )

    fireEvent.click(screen.getByRole('button', { name: 'quarter' }))
    expect(screen.getByTestId('total')).toHaveTextContent('725')
  })

  it('forgets the first month amount when the first month changes', async () => {
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    render(<Harness />)

    await chooseMonth(/Novembre 2026/)
    fireEvent.change(screen.getByLabelText('firstAmount'), { target: { value: '30' } })
    expect(screen.getByTestId('total')).toHaveTextContent('730')

    await chooseMonth(/Janvier 2027/)
    expect(screen.getByLabelText('firstAmount')).toHaveValue(null)
    expect(screen.getByTestId('total')).toHaveTextContent('600')
  })

  it('offers the first month only, not its amount, on a plan that is not monthly', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    render(<Harness paymentSchedule={quarterly} />)

    expect(screen.getByRole('combobox', { name: 'startMonth' })).toBeInTheDocument()
    expect(screen.queryByLabelText('firstAmount')).not.toBeInTheDocument()
    expect(screen.getByText('hintNotMonthly')).toBeInTheDocument()
  })

  it('renders nothing for a plan without a schedule', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    render(<Harness paymentSchedule={{ mode: 'NONE' }} />)

    expect(screen.queryByText('title')).not.toBeInTheDocument()
    expect(screen.getByTestId('total')).toHaveTextContent('1000')
  })
})
