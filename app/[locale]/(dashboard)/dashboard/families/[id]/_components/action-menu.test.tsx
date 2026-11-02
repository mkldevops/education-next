import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionMenu } from './action-menu'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push }) }))

const props = { familyId: 'family-1', paymentsEnabled: true, canDelete: false }

beforeEach(() => push.mockClear())

describe('ActionMenu', () => {
  it('reaches the cashier of the family even with no tuition balance', () => {
    render(<ActionMenu {...props} canRecordPayment={false} canOpenCashier />)

    expect(screen.getAllByRole('button', { name: 'pay' })[0]).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'collectServices' }))

    expect(push).toHaveBeenCalledWith('/dashboard/cashier?familyId=family-1')
  })

  it('offers no cashier entry when the account may not open it', () => {
    render(<ActionMenu {...props} canRecordPayment canOpenCashier={false} />)

    expect(screen.queryByRole('button', { name: 'collectServices' })).not.toBeInTheDocument()
  })

  it('still routes the tuition action through the family dialog', () => {
    render(<ActionMenu {...props} canRecordPayment canOpenCashier={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'pay' }))

    expect(push).toHaveBeenCalledWith('/dashboard/families/family-1?action=addPayment')
  })
})
