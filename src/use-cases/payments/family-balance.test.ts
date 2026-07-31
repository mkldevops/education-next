import { describe, expect, it } from 'vitest'
import { calculateFamilyBalance } from './family-balance'

describe('calculateFamilyBalance', () => {
  it('returns an empty balance without enrollments', () => {
    expect(calculateFamilyBalance([])).toEqual({
      enrollments: [],
      totalAmount: 0,
      totalDiscount: 0,
      totalPaid: 0,
      remainingBalance: 0,
      remainingAmountInCents: 0,
    })
  })

  it('uses the already discounted total amount', () => {
    const balance = calculateFamilyBalance([
      {
        id: 'enrollment-1',
        status: 'ACTIVE',
        totalAmount: 80,
        discount: 20,
        payments: [],
      },
    ])

    expect(balance.totalAmount).toBe(80)
    expect(balance.totalDiscount).toBe(20)
    expect(balance.remainingBalance).toBe(80)
    expect(balance.remainingAmountInCents).toBe(8000)
  })

  it('subtracts partial payments and excludes paid enrollments from allocation', () => {
    const balance = calculateFamilyBalance([
      {
        id: 'enrollment-1',
        status: 'ACTIVE',
        totalAmount: 100,
        discount: 0,
        payments: [{ amount: 40 }],
      },
      {
        id: 'enrollment-2',
        status: 'PENDING',
        totalAmount: 50,
        discount: 0,
        payments: [{ amount: 50 }],
      },
    ])

    expect(balance.totalPaid).toBe(90)
    expect(balance.remainingBalance).toBe(60)
    expect(balance.enrollments).toEqual([
      {
        enrollmentId: 'enrollment-1',
        totalAmount: 100,
        discount: 0,
        paidAmount: 40,
        remainingBalance: 60,
      },
    ])
  })

  it('rounds the checkout amount to integer cents', () => {
    const balance = calculateFamilyBalance([
      {
        id: 'enrollment-1',
        status: 'ACTIVE',
        totalAmount: 100.1,
        discount: 0,
        payments: [{ amount: 0.01 }],
      },
    ])

    expect(balance.remainingBalance).toBe(100.09)
    expect(balance.remainingAmountInCents).toBe(10009)
  })
})
