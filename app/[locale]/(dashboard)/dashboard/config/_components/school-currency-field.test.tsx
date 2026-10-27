import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshMock, toastSuccessMock, toastErrorMock, setSchoolCurrencyActionMock } = vi.hoisted(
  () => ({
    refreshMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    setSchoolCurrencyActionMock: vi.fn(),
  })
)

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `currency.${key}`,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: refreshMock }) }))
vi.mock('@/lib/toast', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }))
vi.mock('../../../_lib/school-currency-actions', () => ({
  setSchoolCurrencyAction: setSchoolCurrencyActionMock,
}))

import { SchoolCurrencyField } from './school-currency-field'

async function pick(option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'currency.label' }))
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item)
  fireEvent.click(item)
}

describe('SchoolCurrencyField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves the picked currency and refreshes the page', async () => {
    setSchoolCurrencyActionMock.mockResolvedValue('OK')
    render(<SchoolCurrencyField settings={{ currency: 'EUR', locked: false }} />)

    expect(screen.getByText('currency.stripeHint')).toBeInTheDocument()
    await pick('currency.options.KMF')

    await waitFor(() => expect(setSchoolCurrencyActionMock).toHaveBeenCalledWith('KMF'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(toastSuccessMock).toHaveBeenCalledWith('currency.saved')
  })

  it('reverts and explains the lock when the server refuses the change', async () => {
    setSchoolCurrencyActionMock.mockResolvedValue('currencyLocked')
    render(<SchoolCurrencyField settings={{ currency: 'EUR', locked: false }} />)

    await pick('currency.options.GBP')

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('currency.locked'))
    expect(screen.getByRole('combobox', { name: 'currency.label' })).toHaveTextContent(
      'currency.options.EUR'
    )
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('disables the select and shows the reason once amounts are recorded', () => {
    render(<SchoolCurrencyField settings={{ currency: 'KMF', locked: true }} />)

    expect(screen.getByText('currency.locked')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'currency.label' })).toBeDisabled()
  })
})
