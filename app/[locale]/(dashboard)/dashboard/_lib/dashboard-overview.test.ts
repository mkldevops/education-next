import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  family: { count: vi.fn() },
  student: { count: vi.fn() },
  enrollment: { count: vi.fn(), findMany: vi.fn() },
}
const getSelectedPeriodMock = vi.fn()
const getFamilyBalanceMock = vi.fn()
const getSchoolInsightsMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('@/use-cases/payments/family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))
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

describe('getDashboardOverview, avoided reads', () => {
  it('never reads the family balance for an admin, flag on or off', async () => {
    await getDashboardOverview({ schoolId: 'school-1', userId: 'user-1', isAdmin: true }, true)
    await getDashboardOverview({ schoolId: 'school-1', userId: 'user-1', isAdmin: true }, false)

    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
  })

  it('skips the family balance read for a parent when payments are disabled', async () => {
    const overview = await getDashboardOverview(
      { schoolId: 'school-1', userId: 'user-1', isAdmin: false, familyId: 'family-1' },
      false
    )

    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
    expect(overview.parentBalance).toBeNull()
  })

  it('reads the family balance for a parent when payments are enabled', async () => {
    getFamilyBalanceMock.mockResolvedValue({ remainingBalance: 40 })

    const overview = await getDashboardOverview(
      { schoolId: 'school-1', userId: 'user-1', isAdmin: false, familyId: 'family-1' },
      true
    )

    expect(getFamilyBalanceMock).toHaveBeenCalledWith('school-1', 'family-1')
    expect(overview.parentBalance).toEqual({ remainingBalance: 40 })
  })

  it('does not request the payments relation on recent enrollments when payments are disabled', async () => {
    await getDashboardOverview({ schoolId: 'school-1', userId: 'user-1', isAdmin: true }, false)

    const call = dbMock.enrollment.findMany.mock.calls[0][0]
    expect(call.include).not.toHaveProperty('payments')
  })

  it('requests the payments relation on recent enrollments when payments are enabled', async () => {
    await getDashboardOverview({ schoolId: 'school-1', userId: 'user-1', isAdmin: true }, true)

    const call = dbMock.enrollment.findMany.mock.calls[0][0]
    expect(call.include.payments).toBe(true)
  })

  it('forwards the flag to getSchoolInsights for an admin', async () => {
    await getDashboardOverview({ schoolId: 'school-1', userId: 'user-1', isAdmin: true }, false)

    expect(getSchoolInsightsMock).toHaveBeenCalledWith('school-1', null, false)
  })
})
