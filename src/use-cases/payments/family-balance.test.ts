import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  enrollment: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { calculateFamilyBalance, getFamilyBalance } = await import('./family-balance')

describe('calculateFamilyBalance', () => {
  it('returns an empty balance without enrollments', () => {
    expect(calculateFamilyBalance([])).toEqual({
      enrollments: [],
      payableEnrollments: [],
      totalAmount: 0,
      totalDiscount: 0,
      totalPaid: 0,
      remainingBalance: 0,
      payableBalance: 0,
      payableAmountInCents: 0,
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
    expect(balance.payableAmountInCents).toBe(8000)
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
        status: 'ACTIVE',
        totalAmount: 100,
        discount: 0,
        paidAmount: 40,
        remainingBalance: 60,
      },
    ])
  })

  it('keeps pending enrollments out of the payable balance', () => {
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
        totalAmount: 200,
        discount: 0,
        payments: [],
      },
    ])

    expect(balance.remainingBalance).toBe(260)
    expect(balance.payableBalance).toBe(60)
    expect(balance.payableAmountInCents).toBe(6000)
    expect(balance.payableEnrollments.map((e) => e.enrollmentId)).toEqual(['enrollment-1'])
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
    expect(balance.payableAmountInCents).toBe(10009)
  })
})

describe('getFamilyBalance', () => {
  const schoolId = 'school-1'

  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.enrollment.findMany.mockResolvedValue([])
  })

  it('reads every period of the family without a class assignment filter', async () => {
    await getFamilyBalance(schoolId, 'family-1')

    const where = dbMock.enrollment.findMany.mock.calls[0][0].where

    expect(where).toEqual({
      schoolId,
      status: { in: ['PENDING', 'ACTIVE'] },
      student: {
        person: {
          families: {
            some: { familyId: 'family-1' },
          },
        },
      },
    })
    expect(where).not.toHaveProperty('classAssignments')
  })

  it('cumulates enrollments across periods', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-2025',
        status: 'ACTIVE',
        totalAmount: 600,
        discount: 0,
        payments: [{ amount: 600 }],
      },
      {
        id: 'enrollment-2026',
        status: 'ACTIVE',
        totalAmount: 800,
        discount: 0,
        payments: [{ amount: 600 }],
      },
    ])

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.totalAmount).toBe(1400)
    expect(balance.totalPaid).toBe(1200)
    expect(balance.remainingBalance).toBe(200)
    expect(balance.payableBalance).toBe(200)
  })

  it('keeps pending enrollments out of the payable balance across periods', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-2025',
        status: 'ACTIVE',
        totalAmount: 600,
        discount: 0,
        payments: [{ amount: 500 }],
      },
      {
        id: 'enrollment-2026',
        status: 'PENDING',
        totalAmount: 800,
        discount: 0,
        payments: [],
      },
    ])

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.remainingBalance).toBe(900)
    expect(balance.payableBalance).toBe(100)
    expect(balance.payableEnrollments.map((e) => e.enrollmentId)).toEqual(['enrollment-2025'])
  })
})
