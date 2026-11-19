import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplyDiscountDialog } from './apply-discount-dialog'

const applyDiscountAction = vi.hoisted(() => vi.fn())
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('../../../_lib/enrollment-actions', () => ({ applyDiscountAction }))

function renderDialog(totalPaid: number) {
  render(
    <ApplyDiscountDialog
      enrollmentId="enrollment-1"
      currentTotalAmount={100000}
      currentDiscount={0}
      totalPaid={totalPaid}
      currency="KMF"
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'title' }))
}

const submit = () => screen.getByRole('button', { name: 'submit' })

describe('ApplyDiscountDialog', () => {
  beforeEach(() => applyDiscountAction.mockReset())

  it('does not pretend to apply a discount typed as the unchanged amount due', () => {
    renderDialog(0)
    fireEvent.change(screen.getByLabelText('totalAmount'), { target: { value: '100000' } })

    expect(submit()).toBeDisabled()
  })

  it('explains why a free tuition is blocked by an amount already collected', () => {
    renderDialog(20000)
    fireEvent.click(screen.getByRole('button', { name: 'free' }))

    expect(screen.getByRole('alert')).toHaveTextContent('belowPaid')
    expect(submit()).toBeDisabled()
  })

  it('sends a zero amount due for a free tuition with nothing paid', async () => {
    applyDiscountAction.mockResolvedValue('OK')
    renderDialog(0)
    fireEvent.click(screen.getByRole('button', { name: 'free' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(submit())

    await waitFor(() =>
      expect(applyDiscountAction).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        totalAmount: 0,
      })
    )
  })
})
