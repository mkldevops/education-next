import { describe, expect, it } from 'vitest'
import { priceOn, validateMealPriceDate } from './meal-price'

const PRICES = [
  { amount: 1000, effectiveFrom: '2027-01-04' },
  { amount: 750, effectiveFrom: '2026-09-01' },
]

describe('priceOn', () => {
  it('returns the latest price effective on the day, whatever the input order', () => {
    expect(priceOn(PRICES, '2026-12-31')).toBe(750)
    expect(priceOn(PRICES, '2027-01-04')).toBe(1000)
    expect(priceOn(PRICES, '2027-06-30')).toBe(1000)
  })

  it('has no price before the first one', () => {
    expect(priceOn(PRICES, '2026-08-31')).toBeNull()
    expect(priceOn([], '2026-10-26')).toBeNull()
  })
})

describe('validateMealPriceDate', () => {
  it('refuses a backdated price once the service has one', () => {
    const today = '2026-10-26'
    expect(validateMealPriceDate({ effectiveFrom: '2026-10-25', today, hasPrice: true })).toBe(
      'backdated'
    )
    expect(validateMealPriceDate({ effectiveFrom: today, today, hasPrice: true })).toBe('OK')
  })

  it('lets the first price start in the past', () => {
    expect(
      validateMealPriceDate({ effectiveFrom: '2026-09-01', today: '2026-10-26', hasPrice: false })
    ).toBe('OK')
  })
})
