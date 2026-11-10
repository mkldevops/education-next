import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  enrollment: { findMany: vi.fn() },
  payment: { groupBy: vi.fn() },
}
const regionalSettingsMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: regionalSettingsMock,
}))

const { getFamilyPaymentTracking, getPaymentTrackingByFamily } = await import('./payment-tracking')

const reference = new Date('2026-11-11T12:00:00.000Z')
const monthlySchedule = { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 10 }
const noTracking = {
  expectedToDate: 0,
  overdueAmount: 0,
  dueThisMonth: 0,
  paidToDate: 0,
  tracked: false,
}

type FamilyLink = {
  familyId: string
  relationType: 'PARENT' | 'TUTOR' | 'OTHER'
  family: { id: string; name: string }
}

function familyLink(
  id = 'family-1',
  relationType: FamilyLink['relationType'] = 'PARENT'
): FamilyLink {
  return { familyId: id, relationType, family: { id, name: id === 'family-1' ? 'Diallo' : id } }
}

function enrollment({
  id = 'enrollment-1',
  totalAmount = 1000,
  schedule = monthlySchedule as unknown,
  families = [familyLink()],
  periodStart = '2026-09-01T00:00:00.000Z',
}: {
  id?: string
  totalAmount?: number
  schedule?: unknown
  families?: FamilyLink[]
  periodStart?: string | null
} = {}) {
  return {
    id,
    totalAmount,
    plan: { paymentSchedule: schedule },
    classAssignments: periodStart
      ? [
          {
            classPeriod: { period: { startAt: new Date(periodStart) } },
          },
        ]
      : [],
    student: { person: { families } },
  }
}

function paid(amount: number, enrollmentId = 'enrollment-1') {
  return { enrollmentId, _sum: { amount } }
}

describe('payment tracking reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    regionalSettingsMock.mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' })
    dbMock.enrollment.findMany.mockResolvedValue([enrollment()])
    dbMock.payment.groupBy.mockResolvedValue([paid(250)])
  })

  it('owes this month the arrears plus the deadlines still to come before the month ends', async () => {
    dbMock.payment.groupBy.mockResolvedValue([paid(150)])

    // Nov 5: Sep and Oct elapsed (200), Nov 10 still ahead (100); 150 paid, 50 late, 150 owed this month.
    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2026-11-05T12:00:00Z'))
    ).toEqual({
      expectedToDate: 200,
      overdueAmount: 50,
      dueThisMonth: 150,
      paidToDate: 150,
      tracked: true,
    })
  })

  it('distinguishes annual balance from the amount overdue across elapsed monthly deadlines', async () => {
    // Annual balance is 750; only three 100-euro installments have elapsed, so 50 is late.
    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual({
      expectedToDate: 300,
      overdueAmount: 50,
      dueThisMonth: 50,
      paidToDate: 250,
      tracked: true,
    })
    expect(regionalSettingsMock).toHaveBeenCalledWith('school-1')
  })

  it('uses the enrollment total after discount, rather than the current plan price', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([enrollment({ totalAmount: 800 })])
    dbMock.payment.groupBy.mockResolvedValue([paid(200)])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual({
      expectedToDate: 240,
      overdueAmount: 40,
      dueThisMonth: 40,
      paidToDate: 200,
      tracked: true,
    })
  })

  it('does not mark an advance payment overdue and includes refund-adjusted totals', async () => {
    dbMock.payment.groupBy.mockResolvedValue([paid(400)])
    expect((await getFamilyPaymentTracking('school-1', 'family-1', reference)).overdueAmount).toBe(
      0
    )

    // A 250 payment followed by a 100 refund leaves 150 received against 300 expected.
    dbMock.payment.groupBy.mockResolvedValue([paid(150)])
    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toMatchObject({
      expectedToDate: 300,
      paidToDate: 150,
      overdueAmount: 150,
      dueThisMonth: 150,
    })
  })

  it.each([{ mode: 'NONE' }, null])(
    'leaves %j plans outside overdue tracking',
    async (schedule) => {
      dbMock.enrollment.findMany.mockResolvedValue([enrollment({ schedule })])
      dbMock.payment.groupBy.mockResolvedValue([])

      expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual(noTracking)
      expect(await getPaymentTrackingByFamily('school-1', { reference })).toEqual([
        { familyId: 'family-1', familyName: 'Diallo', ...noTracking },
      ])
    }
  )

  it('retains money received for an untracked family without inventing an overdue amount', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([enrollment({ schedule: { mode: 'NONE' } })])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual({
      tracked: false,
      expectedToDate: 0,
      overdueAmount: 0,
      dueThisMonth: 0,
      paidToDate: 250,
    })
  })

  it('ignores enrollments without a debtor family or an identifiable period', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ families: [] }),
      enrollment({ id: 'no-period', periodStart: null }),
    ])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual(noTracking)
  })

  it('attributes shared-custody debt to the priority debtor and hides it from a secondary family', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({
        families: [familyLink('family-1', 'OTHER'), familyLink('family-parent', 'PARENT')],
      }),
    ])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual(noTracking)
    expect(await getPaymentTrackingByFamily('school-1', { reference })).toEqual([
      {
        familyId: 'family-parent',
        familyName: 'family-parent',
        expectedToDate: 300,
        overdueAmount: 50,
        dueThisMonth: 50,
        paidToDate: 250,
        tracked: true,
      },
    ])
  })

  it('compares the family expected amount with all payments allocated across its enrollments', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'enrollment-1' }),
      enrollment({ id: 'enrollment-2' }),
    ])
    dbMock.payment.groupBy.mockResolvedValue([paid(400), paid(200, 'enrollment-2')])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual({
      expectedToDate: 600,
      overdueAmount: 0,
      dueThisMonth: 0,
      paidToDate: 600,
      tracked: true,
    })
  })

  it('keeps a family up to date when a payment is split across monthly and future quarterly deadlines', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'monthly' }),
      enrollment({
        id: 'quarterly',
        schedule: { mode: 'QUARTERLY', firstMonth: 12, count: 4, dueDay: 10 },
      }),
    ])
    // The allocator divides a 100 family payment 50/50 over equal remaining balances.
    dbMock.payment.groupBy.mockResolvedValue([paid(50, 'monthly'), paid(50, 'quarterly')])

    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2026-09-11T12:00:00Z'))
    ).toEqual({
      expectedToDate: 100,
      overdueAmount: 0,
      dueThisMonth: 0,
      paidToDate: 100,
      tracked: true,
    })
  })

  it('counts the part allocated to an untracked enrollment when settling family deadlines', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'monthly' }),
      enrollment({ id: 'untracked', schedule: { mode: 'NONE' } }),
    ])
    dbMock.payment.groupBy.mockResolvedValue([paid(50, 'monthly'), paid(50, 'untracked')])

    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2026-09-11T12:00:00Z'))
    ).toEqual({
      expectedToDate: 100,
      overdueAmount: 0,
      dueThisMonth: 0,
      paidToDate: 100,
      tracked: true,
    })
  })

  it('never uses another family advance to cover the debtor family shortfall', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'ahead', families: [familyLink('family-ahead')] }),
      enrollment({ id: 'late', families: [familyLink('family-late')] }),
    ])
    dbMock.payment.groupBy.mockResolvedValue([paid(500, 'ahead'), paid(200, 'late')])

    const families = await getPaymentTrackingByFamily('school-1', { reference })
    expect(families).toEqual([
      {
        familyId: 'family-late',
        familyName: 'family-late',
        expectedToDate: 300,
        paidToDate: 200,
        overdueAmount: 100,
        dueThisMonth: 100,
        tracked: true,
      },
      {
        familyId: 'family-ahead',
        familyName: 'family-ahead',
        expectedToDate: 300,
        paidToDate: 500,
        overdueAmount: 0,
        dueThisMonth: 0,
        tracked: true,
      },
    ])
  })

  it('caps credited money at the full annual enrollment total so a true overpayment cannot erase sibling debt', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'overpaid', totalAmount: 1000 }),
      enrollment({ id: 'unpaid', totalAmount: 100 }),
    ])
    dbMock.payment.groupBy.mockResolvedValue([paid(1200, 'overpaid')])

    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2028-01-01T12:00:00Z'))
    ).toEqual({
      expectedToDate: 1100,
      paidToDate: 1200,
      overdueAmount: 100,
      dueThisMonth: 100,
      tracked: true,
    })
  })

  it('scopes active enrollment and payment reads to the school, period and debtor family', async () => {
    await getPaymentTrackingByFamily('school-1', {
      familyId: 'family-1',
      periodId: 'period-1',
      reference,
    })

    const enrollmentWhere = {
      schoolId: 'school-1',
      isActive: true,
      status: { in: ['PENDING', 'ACTIVE'] },
      student: { person: { families: { some: { familyId: 'family-1' } } } },
      classAssignments: { some: { classPeriod: { periodId: 'period-1' } } },
    }
    expect(dbMock.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: enrollmentWhere,
      })
    )
    expect(dbMock.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: 'school-1',
          isActive: true,
          enrollment: enrollmentWhere,
        }),
      })
    )
  })

  it('starts overdue on the next school-local day, with future payments excluded at that day boundary', async () => {
    regionalSettingsMock.mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    const payments = [
      { amount: 250, paidAt: new Date('2026-11-10T08:00:00Z') },
      { amount: 500, paidAt: new Date('2026-11-11T21:00:00Z') },
    ]
    dbMock.payment.groupBy.mockImplementation(({ where }: { where: { paidAt: { lt: Date } } }) =>
      Promise.resolve([
        paid(
          payments
            .filter((payment) => payment.paidAt < where.paidAt.lt)
            .reduce((sum, payment) => sum + payment.amount, 0)
        ),
      ])
    )

    // At 21:30 UTC the school's day has advanced to November 11, after the November 10 deadline.
    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2026-11-10T21:30:00Z'))
    ).toEqual({
      expectedToDate: 300,
      overdueAmount: 50,
      dueThisMonth: 50,
      paidToDate: 250,
      tracked: true,
    })
    expect(dbMock.payment.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paidAt: { lt: new Date('2026-11-11T21:00:00Z') } }),
      })
    )

    expect(
      await getFamilyPaymentTracking('school-1', 'family-1', new Date('2026-11-10T20:30:00Z'))
    ).toEqual({
      expectedToDate: 200,
      overdueAmount: 0,
      dueThisMonth: 50,
      paidToDate: 250,
      tracked: true,
    })
  })

  it('keeps deadlines anchored to the enrollment period rather than restarting the current year', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ periodStart: '2025-09-01T00:00:00Z' }),
    ])

    expect(await getFamilyPaymentTracking('school-1', 'family-1', reference)).toEqual({
      expectedToDate: 1000,
      overdueAmount: 750,
      dueThisMonth: 750,
      paidToDate: 250,
      tracked: true,
    })
    expect(dbMock.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          classAssignments: expect.objectContaining({
            orderBy: { startAt: 'desc' },
            take: 1,
          }),
        }),
      })
    )
  })

  it('orders overdue families by the actual overdue amount, ahead of up-to-date tracked families', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      enrollment({ id: 'ahead', families: [familyLink('family-ahead')] }),
      enrollment({ id: 'late', families: [familyLink('family-late')] }),
    ])
    dbMock.payment.groupBy.mockResolvedValue([paid(500, 'ahead'), paid(50, 'late')])

    expect(
      (await getPaymentTrackingByFamily('school-1', { reference })).map((family) => [
        family.familyId,
        family.overdueAmount,
      ])
    ).toEqual([
      ['family-late', 250],
      ['family-ahead', 0],
    ])
  })
})
