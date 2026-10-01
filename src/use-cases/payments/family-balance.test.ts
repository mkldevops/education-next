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
    expect(balance.payableEnrollments.map((e) => e.enrollmentId)).toEqual([
      'enrollment-1',
      'enrollment-2',
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
      payableEnrollments: [],
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

  it('accepts a paid total aggregated in the database instead of the payment rows', () => {
    const fromRows = calculateFamilyBalance([
      {
        id: 'active',
        status: 'ACTIVE',
        totalAmount: 180,
        discount: 0,
        payments: [{ amount: 40.1 }, { amount: 19.9 }],
      },
      {
        id: 'cancelled',
        status: 'CANCELLED',
        totalAmount: 180,
        discount: 0,
        payments: [{ amount: 25 }],
      },
    ])
    const fromTotals = calculateFamilyBalance([
      {
        id: 'active',
        status: 'ACTIVE',
        totalAmount: 180,
        discount: 0,
        paid: { toString: () => '60.00' },
      },
      { id: 'cancelled', status: 'CANCELLED', totalAmount: 180, discount: 0, paid: 25 },
    ])

    expect(fromTotals).toEqual(fromRows)
    expect(fromTotals).toMatchObject({ totalPaid: 85, remainingBalance: 120 })
  })

  it('treats an enrollment without any payment as unpaid when the total is null', () => {
    const balance = calculateFamilyBalance([
      { id: 'enrollment-1', status: 'PENDING', totalAmount: 180, discount: 0, paid: null },
    ])

    expect(balance.totalPaid).toBe(0)
    expect(balance.remainingBalance).toBe(180)
  })
})

describe('getFamilyBalance', () => {
  const schoolId = 'school-1'

  /** Un élève rattaché à `family-1` seule, comme la grande majorité des données réelles. */
  const debtorOfFamily1 = {
    student: { person: { families: [{ familyId: 'family-1', relationType: 'OTHER' }] } },
  }

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
        ...debtorOfFamily1,
      },
      {
        id: 'enrollment-2026',
        status: 'ACTIVE',
        totalAmount: 800,
        discount: 0,
        payments: [{ amount: 600 }],
        ...debtorOfFamily1,
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
        ...debtorOfFamily1,
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
        ...debtorOfFamily1,
      },
      {
        id: 'enrollment-2026',
        status: 'PENDING',
        totalAmount: 800,
        discount: 0,
        payments: [],
        ...debtorOfFamily1,
      },
    ])

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.remainingBalance).toBe(900)
    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual([
      'enrollment-2025',
      'enrollment-2026',
    ])
  })

  it('excludes a shared-custody student whose parent family is elsewhere', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-own',
        status: 'ACTIVE',
        totalAmount: 180,
        discount: 0,
        payments: [],
        ...debtorOfFamily1,
      },
      {
        // Élève en garde partagée : rattaché à family-1 (OTHER) et family-2 (PARENT).
        // family-2 est prioritaire, donc family-1 ne doit rien voir de cette inscription.
        id: 'enrollment-shared',
        status: 'ACTIVE',
        totalAmount: 300,
        discount: 0,
        payments: [],
        student: {
          person: {
            families: [
              { familyId: 'family-1', relationType: 'OTHER' },
              { familyId: 'family-2', relationType: 'PARENT' },
            ],
          },
        },
      },
    ])

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual(['enrollment-own'])
    expect(balance.totalAmount).toBe(180)
  })

  it('includes a shared-custody student whose parent link is this family', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-shared',
        status: 'ACTIVE',
        totalAmount: 300,
        discount: 0,
        payments: [],
        student: {
          person: {
            families: [
              { familyId: 'family-1', relationType: 'PARENT' },
              { familyId: 'family-2', relationType: 'OTHER' },
            ],
          },
        },
      },
    ])

    const balance = await getFamilyBalance(schoolId, 'family-1')

    expect(balance.enrollments.map((e) => e.enrollmentId)).toEqual(['enrollment-shared'])
    expect(balance.totalAmount).toBe(300)
  })
})
