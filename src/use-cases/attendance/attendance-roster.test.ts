import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = {
  attendanceSession: { findUnique: vi.fn(), updateMany: vi.fn() },
  attendanceEntry: { findMany: vi.fn(), createMany: vi.fn() },
  classAssignment: { findMany: vi.fn() },
}
const db = {
  ...tx,
  attendanceSession: { ...tx.attendanceSession, findMany: vi.fn() },
  $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
}
vi.mock('@/lib/db', () => ({ db }))

const { refreshSessionRoster, syncOpenAttendanceRosters } = await import('./attendance-roster')

const assignment = (studentId: string, lastname: string, name: string) => ({
  enrollment: { studentId, student: { person: { lastname, name } } },
})

beforeEach(() => {
  vi.clearAllMocks()
  tx.attendanceSession.findUnique.mockResolvedValue({
    status: 'DRAFT',
    classPeriodId: 'class-1',
    occurredOn: new Date('2026-11-21T00:00:00Z'),
  })
  tx.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
  tx.attendanceEntry.findMany.mockResolvedValue([{ studentId: 'old' }])
  tx.classAssignment.findMany.mockResolvedValue([
    assignment('old', 'Ali', 'Said'),
    assignment('new', 'Nouroudini', 'Yusri'),
  ])
})

describe('refreshSessionRoster', () => {
  const input = {
    schoolId: 's',
    sessionId: 'session',
    actorId: 'u',
    status: 'NOT_RECORDED' as const,
  }

  it('adds only the students missing from the call, with the requested status', async () => {
    const result = await refreshSessionRoster(tx as never, input)

    expect(result).toEqual({ added: [{ studentId: 'new', studentName: 'Nouroudini Yusri' }] })
    expect(tx.attendanceEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          status: 'NOT_RECORDED',
          studentId: 'new',
          studentName: 'Nouroudini Yusri',
          schoolId: 's',
          attendanceSessionId: 'session',
          updatedById: 'u',
        },
      ],
      skipDuplicates: true,
    })
  })

  it('writes nothing when the roster is already complete', async () => {
    tx.attendanceEntry.findMany.mockResolvedValue([{ studentId: 'old' }, { studentId: 'new' }])

    expect(await refreshSessionRoster(tx as never, input)).toEqual({ added: [] })
    expect(tx.attendanceEntry.createMany).not.toHaveBeenCalled()
  })

  it('reads the session in the caller school only', async () => {
    tx.attendanceSession.findUnique.mockResolvedValue(null)

    expect(await refreshSessionRoster(tx as never, input)).toBe('notFound')
    expect(tx.attendanceSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_schoolId: { id: 'session', schoolId: 's' } } })
    )
  })

  it.each(['VALIDATED', 'CANCELLED'])('refuses a %s call', async (status) => {
    tx.attendanceSession.findUnique.mockResolvedValue({
      status,
      classPeriodId: 'c',
      occurredOn: new Date(),
    })

    expect(await refreshSessionRoster(tx as never, input)).toBe('invalidTransition')
    expect(tx.attendanceEntry.createMany).not.toHaveBeenCalled()
  })

  it('refuses when a concurrent validation won the lock', async () => {
    tx.attendanceSession.updateMany.mockResolvedValue({ count: 0 })

    expect(await refreshSessionRoster(tx as never, input)).toBe('invalidTransition')
    expect(tx.attendanceEntry.createMany).not.toHaveBeenCalled()
  })
})

describe('syncOpenAttendanceRosters', () => {
  const now = new Date('2026-11-21T15:30:00Z')

  it('refreshes the calls in progress of the new classes, from today on', async () => {
    db.classAssignment.findMany.mockResolvedValueOnce([
      { classPeriodId: 'class-1' },
      { classPeriodId: 'class-1' },
    ])
    db.attendanceSession.findMany.mockResolvedValue([{ id: 'session' }])

    const added = await syncOpenAttendanceRosters(
      { schoolId: 's', actorId: 'u', enrollmentIds: ['e1', 'e2'] },
      now
    )

    expect(added).toBe(1)
    expect(db.attendanceSession.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: 's',
        classPeriodId: { in: ['class-1'] },
        status: 'DRAFT',
        occurredOn: { gte: new Date('2026-11-21T00:00:00Z') },
      },
      select: { id: true },
    })
    expect(tx.attendanceEntry.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ status: 'NOT_RECORDED', studentId: 'new' })],
      })
    )
  })

  it('does nothing without enrollment', async () => {
    expect(
      await syncOpenAttendanceRosters({ schoolId: 's', actorId: 'u', enrollmentIds: [] }, now)
    ).toBe(0)
    expect(db.classAssignment.findMany).not.toHaveBeenCalled()
  })

  it('never throws: the enrollment is already committed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    db.classAssignment.findMany.mockRejectedValueOnce(new Error('db down'))

    await expect(
      syncOpenAttendanceRosters({ schoolId: 's', actorId: 'u', enrollmentIds: ['e1'] }, now)
    ).resolves.toBe(0)
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
