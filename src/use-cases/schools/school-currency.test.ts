import { beforeEach, describe, expect, it, vi } from 'vitest'

const regionalSettingsMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: regionalSettingsMock,
}))

import { getSchoolCurrencySettings, setSchoolCurrency } from './school-currency'

const schoolGw = { updateCurrency: vi.fn() }
const paymentGw = { hasRecordedAmounts: vi.fn() }
const gateways = [
  schoolGw as unknown as NonNullable<Parameters<typeof setSchoolCurrency>[1]>,
  paymentGw as unknown as NonNullable<Parameters<typeof setSchoolCurrency>[2]>,
] as const

const schoolId = 'school-1'

describe('school currency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    regionalSettingsMock.mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' })
    paymentGw.hasRecordedAmounts.mockResolvedValue(false)
  })

  it('changes the currency while no amount is recorded', async () => {
    await expect(setSchoolCurrency({ schoolId, currency: 'KMF' }, ...gateways)).resolves.toBe('OK')

    expect(paymentGw.hasRecordedAmounts).toHaveBeenCalledWith(schoolId)
    expect(schoolGw.updateCurrency).toHaveBeenCalledWith(schoolId, 'KMF')
  })

  it('refuses the change once an active payment or receipt is recorded', async () => {
    paymentGw.hasRecordedAmounts.mockResolvedValue(true)

    await expect(setSchoolCurrency({ schoolId, currency: 'GBP' }, ...gateways)).resolves.toBe(
      'currencyLocked'
    )
    expect(schoolGw.updateCurrency).not.toHaveBeenCalled()
  })

  it('accepts the current currency as a no-op, even when locked', async () => {
    regionalSettingsMock.mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    paymentGw.hasRecordedAmounts.mockResolvedValue(true)

    await expect(setSchoolCurrency({ schoolId, currency: 'KMF' }, ...gateways)).resolves.toBe('OK')
    expect(schoolGw.updateCurrency).not.toHaveBeenCalled()
  })

  it('rejects a currency outside the allowed list', async () => {
    await expect(setSchoolCurrency({ schoolId, currency: 'USD' }, ...gateways)).resolves.toBe(
      'validationError'
    )
    expect(regionalSettingsMock).not.toHaveBeenCalled()
    expect(schoolGw.updateCurrency).not.toHaveBeenCalled()
  })

  it('reports the current currency and whether it is locked', async () => {
    regionalSettingsMock.mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    paymentGw.hasRecordedAmounts.mockResolvedValue(true)

    await expect(getSchoolCurrencySettings(schoolId, gateways[1])).resolves.toEqual({
      currency: 'KMF',
      locked: true,
    })
  })
})
