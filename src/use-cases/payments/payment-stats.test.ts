import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  enrollment: { findMany: vi.fn() },
  payment: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { getPaymentStats } = await import('./payment-stats')

const reference = new Date('2026-09-13T00:00:00.000Z')

describe('getPaymentStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-1',
        totalAmount: 180,
        student: { person: { families: [{ family: { id: 'family-1', name: 'Diallo' } }] } },
      },
    ])
    dbMock.payment.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(
        by[0] === 'enrollmentId'
          ? [{ enrollmentId: 'enrollment-1', _sum: { amount: 60 } }]
          : [{ method: 'CHECK', _sum: { amount: 60 }, _count: { _all: 1 } }]
      )
    )
    dbMock.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 60 }, _count: { _all: 1 } })
      .mockResolvedValueOnce({ _max: { paidAt: new Date('2026-09-02T00:00:00.000Z') } })
    dbMock.payment.findMany.mockResolvedValue([
      { amount: 60, paidAt: new Date('2026-09-02T00:00:00.000Z') },
    ])
  })

  it('aggregates payments in the database, scoped to the school', async () => {
    const stats = await getPaymentStats('school-1', 'period-1', reference)

    expect(stats.totals).toMatchObject({
      due: 180,
      collected: 60,
      remaining: 120,
      paymentCount: 1,
      uncashedAmount: 60,
      uncashedCount: 1,
    })
    expect(stats.methods).toEqual([{ method: 'CHECK', amount: 60, count: 1, share: 100 }])
    expect(stats.families[0]).toMatchObject({ familyId: 'family-1', remaining: 120 })

    for (const [args] of dbMock.payment.groupBy.mock.calls) {
      expect(args.where).toMatchObject({
        schoolId: 'school-1',
        isActive: true,
        enrollment: { schoolId: 'school-1', isActive: true },
      })
    }
  })

  it('caps the latest-payment lookup at the current month', async () => {
    await getPaymentStats('school-1', null, reference)

    expect(dbMock.payment.aggregate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: { lt: new Date('2026-10-01T00:00:00.000Z') },
        }),
      })
    )
  })

  it('reads only the rows of the charted window', async () => {
    const stats = await getPaymentStats('school-1', null, reference)

    expect(dbMock.payment.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        paidAt: {
          gte: new Date('2025-10-01T00:00:00.000Z'),
          lt: new Date('2026-10-01T00:00:00.000Z'),
        },
      }),
      select: { amount: true, paidAt: true },
    })
    expect(stats.monthly).toHaveLength(12)
    expect(stats.monthly.at(-1)).toEqual({ month: '2026-09', amount: 60, count: 1 })
  })
})
