import { beforeEach, describe, expect, it, vi } from 'vitest'

const isPaymentsEnabled = vi.fn()
const configGet = vi.fn()
const findSessions = vi.fn()
const countEnrollments = vi.fn()

vi.mock('@/use-cases/config/is-payments-enabled', () => ({ isPaymentsEnabled }))
vi.mock('@/gateways/config-gateway', () => ({ configGateway: { get: configGet } }))
vi.mock('@/lib/db', () => ({
  db: {
    attendanceSession: { findMany: findSessions },
    enrollment: { count: countEnrollments },
  },
}))
vi.mock('@/use-cases/payments/overdue-students', () => ({ getOverdueStudents: vi.fn() }))

const { getAssistantBriefing } = await import('./assistant-briefing')

const NOW = new Date('2026-11-21T15:30:00Z')
const student = (familyId: string, overdueAmount: number) => ({
  family: { id: familyId, overdueAmount },
})

describe('getAssistantBriefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    isPaymentsEnabled.mockResolvedValue(true)
    configGet.mockResolvedValue({ value: 'true' })
    findSessions.mockResolvedValue([])
    countEnrollments.mockResolvedValue(0)
  })

  it('counts overdue families once each, open calls of today and pending enrollments', async () => {
    const overdue = vi
      .fn()
      .mockResolvedValue([student('f1', 120.5), student('f1', 120.5), student('f2', 80)])
    findSessions.mockResolvedValue([
      { classPeriod: { name: '6e B' } },
      { classPeriod: { name: '6e B' } },
      { classPeriod: { name: 'CM2 A' } },
    ])
    countEnrollments.mockResolvedValue(4)

    const briefing = await getAssistantBriefing('school-1', NOW, overdue as never)

    expect(briefing).toEqual({
      overdue: { families: 2, amount: 200.5 },
      openCalls: { count: 3, classes: ['6e B', 'CM2 A'] },
      pendingEnrollments: 4,
    })
    expect(overdue).toHaveBeenCalledWith('school-1')
    expect(findSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          status: 'DRAFT',
          occurredOn: {
            gte: new Date('2026-11-21T00:00:00Z'),
            lt: new Date('2026-11-22T00:00:00Z'),
          },
        },
      })
    )
    expect(countEnrollments).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', status: 'PENDING' },
    })
  })

  it('hides the cards of closed modules', async () => {
    isPaymentsEnabled.mockResolvedValue(false)
    configGet.mockResolvedValue(null)
    const overdue = vi.fn()

    const briefing = await getAssistantBriefing('school-1', NOW, overdue)

    expect(briefing.overdue).toBeNull()
    expect(briefing.openCalls).toBeNull()
    expect(overdue).not.toHaveBeenCalled()
    expect(findSessions).not.toHaveBeenCalled()
  })

  it('hides only the card whose read failed', async () => {
    const overdue = vi.fn().mockRejectedValue(new Error('boom'))
    countEnrollments.mockResolvedValue(2)

    const briefing = await getAssistantBriefing('school-1', NOW, overdue)

    expect(briefing).toEqual({
      overdue: null,
      openCalls: { count: 0, classes: [] },
      pendingEnrollments: 2,
    })
  })
})
