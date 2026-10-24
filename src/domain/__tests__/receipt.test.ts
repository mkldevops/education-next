import { describe, expect, it } from 'vitest'
import { canonicalReceiptRequest, formatReceiptNumber, receiptTotal } from '../receipt'

const request = {
  familyId: 'f',
  method: 'CASH',
  reference: null,
  tuition: 100,
  meals: [
    { studentId: 'b', service: 'SNACK', amount: 0.3, expectedPaidThrough: null },
    { studentId: 'a', service: 'CANTEEN', amount: 1500, expectedPaidThrough: '2026-09-11' },
  ],
}

describe('receipt', () => {
  it('pads the number to six digits', () => {
    expect(formatReceiptNumber(123)).toBe('R-000123')
    expect(formatReceiptNumber(1234567)).toBe('R-1234567')
  })

  it('ignores line order and number writing in the canonical form', () => {
    const reordered = {
      ...request,
      tuition: 100.0,
      meals: [request.meals[1], { ...request.meals[0], amount: 0.1 + 0.2 }],
    }
    expect(canonicalReceiptRequest(reordered)).toBe(canonicalReceiptRequest(request))
  })

  it('changes the canonical form with the content', () => {
    expect(canonicalReceiptRequest({ ...request, method: 'CHECK' })).not.toBe(
      canonicalReceiptRequest(request)
    )
  })

  it('totals to the hundredth', () => {
    expect(receiptTotal({ tuition: 0.1, meals: [{ amount: 0.2 }] as never })).toBe(0.3)
  })
})
