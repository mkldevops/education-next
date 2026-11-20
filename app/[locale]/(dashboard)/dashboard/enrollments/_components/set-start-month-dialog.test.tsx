import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetStartMonthDialog, type StartMonthSetting } from './set-start-month-dialog'

const setEnrollmentStartMonthAction = vi.hoisted(() => vi.fn())
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('../../../_lib/enrollment-actions', () => ({ setEnrollmentStartMonthAction }))

const monthly: StartMonthSetting = {
  value: null,
  min: '2026-09',
  max: '2027-07',
  firstInstallmentAmount: null,
  monthlyPlan: true,
}

function renderDialog(startMonth: StartMonthSetting, discount = 0) {
  render(
    <SetStartMonthDialog
      enrollmentId="enrollment-1"
      startMonth={startMonth}
      discount={discount}
      currency="KMF"
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'title' }))
}

const firstInstallment = () => screen.getByLabelText('firstInstallment')
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'submit' }))

describe('SetStartMonthDialog', () => {
  beforeEach(() => setEnrollmentStartMonthAction.mockReset())

  it('waits for a start month before taking a reduced first month', () => {
    renderDialog(monthly)

    expect(firstInstallment()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('label'), { target: { value: '2026-10' } })

    expect(firstInstallment()).toBeEnabled()
  })

  it('sends the reduced first month with its start month', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog(monthly)
    fireEvent.change(screen.getByLabelText('label'), { target: { value: '2026-10' } })
    fireEvent.change(firstInstallment(), { target: { value: '5000' } })
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: '2026-10',
        firstInstallmentAmount: 5000,
        removeDiscount: false,
      })
    )
  })

  it('drops the reduced first month when the start month is cleared', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog({ ...monthly, value: '2026-10', firstInstallmentAmount: 5000 })
    fireEvent.change(screen.getByLabelText('label'), { target: { value: '' } })
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: null,
        firstInstallmentAmount: null,
        removeDiscount: false,
      })
    )
  })

  it('forgets the reduced first month of the previous start month', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog({ ...monthly, value: '2026-10', firstInstallmentAmount: 5000 })

    expect(firstInstallment()).toHaveValue(5000)

    fireEvent.change(screen.getByLabelText('label'), { target: { value: '2026-12' } })

    expect(firstInstallment()).toHaveValue(null)
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: '2026-12',
        firstInstallmentAmount: null,
        removeDiscount: false,
      })
    )
  })

  it('sends the amount typed again after the start month changed', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog({ ...monthly, value: '2026-10', firstInstallmentAmount: 5000 })
    fireEvent.change(screen.getByLabelText('label'), { target: { value: '2026-12' } })
    fireEvent.change(firstInstallment(), { target: { value: '3000' } })
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: '2026-12',
        firstInstallmentAmount: 3000,
        removeDiscount: false,
      })
    )
  })

  it('does not offer a reduced first month on a plan that is not monthly', () => {
    renderDialog({ ...monthly, monthlyPlan: false })

    expect(screen.queryByLabelText('firstInstallment')).not.toBeInTheDocument()
  })

  it('shows the existing discount and removes it on request', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog({ ...monthly, value: '2026-10' }, 20000)

    expect(screen.getByText('currentDiscount')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('removeDiscount'))
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: '2026-10',
        firstInstallmentAmount: null,
        removeDiscount: true,
      })
    )
  })

  it('shows the schedule before and after, with the first month edited in its line', async () => {
    setEnrollmentStartMonthAction.mockResolvedValue('OK')
    renderDialog({
      ...monthly,
      schedule: {
        planAmount: 100000,
        paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 },
        periodStartAt: '2026-09-01T00:00:00.000Z',
        totalAmount: 100000,
      },
    })

    // En-tête, dix échéances, total : rien ne change tant que le mois n'est pas saisi.
    expect(screen.getAllByRole('row')).toHaveLength(12)
    expect(screen.queryByText('becomes')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('label'), { target: { value: '2027-04' } })
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent(/septembre 2026.*10.000.*none/)
    expect(rows.at(-1)).toHaveTextContent(/total.*100.000.*30.000/)

    fireEvent.click(screen.getByRole('button', { name: 'half' }))
    expect(firstInstallment()).toHaveValue(5000)
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent(/total.*100.000.*25.000/)
    submit()

    await waitFor(() =>
      expect(setEnrollmentStartMonthAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        startMonth: '2027-04',
        firstInstallmentAmount: 5000,
        removeDiscount: false,
      })
    )
  })

  it('hides the discount option from an enrollment without a discount', () => {
    renderDialog(monthly)

    expect(screen.queryByLabelText('removeDiscount')).not.toBeInTheDocument()
  })
})
