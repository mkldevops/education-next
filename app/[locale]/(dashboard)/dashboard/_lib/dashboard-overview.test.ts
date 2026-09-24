import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  family: { count: vi.fn() },
  student: { count: vi.fn(), findMany: vi.fn() },
  enrollment: { count: vi.fn(), findMany: vi.fn() },
}
const getSelectedPeriodMock = vi.fn()
const getSchoolInsightsMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('./school-insights', () => ({ getSchoolInsights: getSchoolInsightsMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getDashboardOverview } = await import('./dashboard-overview')

beforeEach(() => {
  vi.clearAllMocks()
  getSelectedPeriodMock.mockResolvedValue(null)
  dbMock.family.count.mockResolvedValue(0)
  dbMock.student.count.mockResolvedValue(0)
  dbMock.enrollment.count.mockResolvedValue(0)
  dbMock.enrollment.findMany.mockResolvedValue([])
  getSchoolInsightsMock.mockResolvedValue({ payments: null, classes: [], levels: [] })
})

describe('getDashboardOverview', () => {
  it('scopes every count and list to the school', async () => {
    await getDashboardOverview('school-1', true)

    for (const mock of [
      dbMock.family.count,
      dbMock.student.count,
      dbMock.enrollment.count,
      dbMock.enrollment.findMany,
    ]) {
      for (const [args] of mock.mock.calls) expect(args.where.schoolId).toBe('school-1')
    }
  })

  it('no longer reads student creation dates for a trend chart', async () => {
    await getDashboardOverview('school-1', true)

    expect(dbMock.student.findMany).not.toHaveBeenCalled()
  })

  it('narrows enrollment counts to the selected period', async () => {
    getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026' })

    await getDashboardOverview('school-1', true)

    const pending = dbMock.enrollment.count.mock.calls.find(
      ([args]) => args.where.status === 'PENDING'
    )
    expect(pending?.[0].where.classAssignments).toEqual({
      some: { classPeriod: { periodId: 'period-1' } },
    })
  })

  it('does not request the payments relation on recent enrollments when payments are disabled', async () => {
    await getDashboardOverview('school-1', false)

    const call = dbMock.enrollment.findMany.mock.calls[0][0]
    expect(call.include).not.toHaveProperty('payments')
  })

  it('requests the payments relation on recent enrollments when payments are enabled', async () => {
    await getDashboardOverview('school-1', true)

    const call = dbMock.enrollment.findMany.mock.calls[0][0]
    expect(call.include.payments).toBe(true)
  })

  it('forwards the flag to getSchoolInsights', async () => {
    await getDashboardOverview('school-1', false)

    expect(getSchoolInsightsMock).toHaveBeenCalledWith('school-1', null, false)
  })
})
