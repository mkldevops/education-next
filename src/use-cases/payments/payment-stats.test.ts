import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  enrollment: { findMany: vi.fn() },
  family: { findMany: vi.fn() },
  payment: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))
const trackingMock = vi.fn()
vi.mock('./payment-tracking', () => ({ getPaymentTrackingByFamily: trackingMock }))

const { getPaymentStats } = await import('./payment-stats')

const reference = new Date('2026-09-13T00:00:00.000Z')

function row(overrides: {
  id?: string
  totalAmount?: number
  families?: Array<{ familyId: string; relationType: string; family: { id: string; name: string } }>
}) {
  return {
    id: overrides.id ?? 'enrollment-1',
    totalAmount: overrides.totalAmount ?? 180,
    student: { person: { families: overrides.families ?? [] } },
  }
}

describe('getPaymentStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trackingMock.mockResolvedValue([])
    dbMock.enrollment.findMany.mockResolvedValue([
      row({
        families: [
          {
            familyId: 'family-1',
            relationType: 'PARENT',
            family: { id: 'family-1', name: 'Diallo' },
          },
        ],
      }),
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
    dbMock.family.findMany.mockResolvedValue([])
  })

  it('gives each listed family the phone of a parent, then a tutor, then its emergency contact', async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: 'family-1',
        emergencyContactPhone: '01 00 00 00 00',
        persons: [
          { relationType: 'TUTOR', person: { phoneNumbers: [{ phoneNumber: '07 22 22 22 22' }] } },
          { relationType: 'PARENT', person: { phoneNumbers: [] } },
          { relationType: 'PARENT', person: { phoneNumbers: [{ phoneNumber: '06 11 11 11 11' }] } },
        ],
      },
    ])

    const stats = await getPaymentStats('school-1', null, reference)

    expect(stats.families[0]).toMatchObject({
      familyId: 'family-1',
      contactPhone: '06 11 11 11 11',
    })
    expect(dbMock.family.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 'school-1', id: { in: ['family-1'] } } })
    )
  })

  it('falls back to the emergency contact, or to no phone at all', async () => {
    dbMock.family.findMany.mockResolvedValue([
      { id: 'family-1', emergencyContactPhone: '01 00 00 00 00', persons: [] },
    ])
    expect((await getPaymentStats('school-1', null, reference)).families[0].contactPhone).toBe(
      '01 00 00 00 00'
    )

    dbMock.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 60 }, _count: { _all: 1 } })
      .mockResolvedValueOnce({ _max: { paidAt: null } })
    dbMock.family.findMany.mockResolvedValue([
      { id: 'family-1', emergencyContactPhone: null, persons: [] },
    ])
    expect((await getPaymentStats('school-1', null, reference)).families[0].contactPhone).toBeNull()
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

  it('keeps annual balances separate from arrears and never offsets debt between families', async () => {
    trackingMock.mockResolvedValue([
      {
        familyId: 'family-1',
        familyName: 'Diallo',
        expectedToDate: 100,
        paidToDate: 60,
        overdueAmount: 40,
        tracked: true,
      },
      {
        familyId: 'family-2',
        familyName: 'Ahead',
        expectedToDate: 50,
        paidToDate: 100,
        overdueAmount: 0,
        tracked: true,
      },
    ])

    const stats = await getPaymentStats('school-1', 'period-1', reference)

    expect(stats.totals.remaining).toBe(120)
    expect(stats.tracking).toEqual({
      expectedToDate: 150,
      paidToDate: 160,
      overdueAmount: 40,
      tracked: true,
    })
    expect(stats.overdueFamilies).toEqual([
      expect.objectContaining({ familyId: 'family-1', overdueAmount: 40 }),
    ])
    expect(trackingMock).toHaveBeenCalledWith('school-1', { periodId: 'period-1', reference })
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

  it('ignores an enrollment attached to no family', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([row({ families: [] })])

    const stats = await getPaymentStats('school-1', null, reference)

    expect(stats.families).toEqual([])
    expect(dbMock.family.findMany).not.toHaveBeenCalled()
  })

  it('attributes the debt to the parent family, not the arbitrary one', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      row({
        totalAmount: 180,
        families: [
          {
            familyId: 'zzz-other',
            relationType: 'OTHER',
            family: { id: 'zzz-other', name: 'Autre' },
          },
          {
            familyId: 'aaa-parent',
            relationType: 'PARENT',
            family: { id: 'aaa-parent', name: 'Parent' },
          },
        ],
      }),
    ])

    const stats = await getPaymentStats('school-1', null, reference)

    expect(stats.families).toHaveLength(1)
    expect(stats.families[0].familyId).toBe('aaa-parent')
  })

  it('matches the same debtor family record-payment would collect from', async () => {
    // `family-1` porte OTHER, `family-2` porte PARENT : bien que `family-1` ait un familyId
    // alphabétiquement plus petit, PARENT doit primer, exactement comme
    // `enrollmentGateway.findPayableByFamily`.
    dbMock.enrollment.findMany.mockResolvedValue([
      row({
        totalAmount: 250,
        families: [
          {
            familyId: 'family-1',
            relationType: 'OTHER',
            family: { id: 'family-1', name: 'Famille A' },
          },
          {
            familyId: 'family-2',
            relationType: 'PARENT',
            family: { id: 'family-2', name: 'Famille B' },
          },
        ],
      }),
    ])

    const stats = await getPaymentStats('school-1', null, reference)

    expect(stats.families).toHaveLength(1)
    expect(stats.families[0].familyId).toBe('family-2')
    expect(stats.families[0].due).toBe(250)
  })
})
