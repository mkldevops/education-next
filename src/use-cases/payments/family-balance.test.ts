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
        status: 'ACTIVE',
        totalAmount: 100,
        discount: 0,
        paidAmount: 40,
        remainingBalance: 60,
      },
    ])
  })

  it('makes pending enrollments payable like active ones', () => {
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
    expect(balance.remainingAmountInCents).toBe(26000)
    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual(['enrollment-1', 'enrollment-2'])
  })

  it('keeps payments of a cancelled enrollment in the total paid without owing it', () => {
    const balance = calculateFamilyBalance([
      {
        id: 'cancelled',
        status: 'CANCELLED',
        totalAmount: 300,
        discount: 0,
        payments: [{ amount: 200 }],
      },
      {
        id: 'completed',
        status: 'COMPLETED',
        totalAmount: 100,
        discount: 10,
        payments: [{ amount: 50 }],
      },
      {
        id: 'active',
        status: 'ACTIVE',
        totalAmount: 150,
        discount: 5,
        payments: [{ amount: 30 }],
      },
    ])

    expect(balance.totalPaid).toBe(280)
    expect(balance.totalAmount).toBe(150)
    expect(balance.totalDiscount).toBe(5)
    expect(balance.remainingBalance).toBe(120)
    expect(balance.remainingAmountInCents).toBe(12000)
    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual(['active'])
  })

  it('shows money received on a cancelled enrollment when nothing else is owed', () => {
    const balance = calculateFamilyBalance([
      {
        id: 'cancelled',
        status: 'CANCELLED',
        totalAmount: 300,
        discount: 0,
        payments: [{ amount: 200 }],
      },
    ])

    expect(balance).toEqual({
      enrollments: [],
      totalAmount: 0,
      totalDiscount: 0,
      totalPaid: 200,
      remainingBalance: 0,
      remainingAmountInCents: 0,
    })
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
      OR: [{ status: { in: ['PENDING', 'ACTIVE'] } }, { payments: { some: { isActive: true } } }],
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
  })

  it('owes four enrollments of 180 as one family balance of 720', async () => {
    dbMock.enrollment.findMany.mockResolvedValue(
      ['a', 'b', 'c', 'd'].map((id, index) => ({
        id,
        status: index < 2 ? 'ACTIVE' : 'PENDING',
        totalAmount: 180,
        discount: 0,
        payments: [],
      }))
    )

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.totalAmount).toBe(720)
    expect(balance.remainingBalance).toBe(720)
    expect(balance.enrollments).toHaveLength(4)
  })

  it('pays pending enrollments across periods', async () => {
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
    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual([
      'enrollment-2025',
      'enrollment-2026',
    ])
  })
})
