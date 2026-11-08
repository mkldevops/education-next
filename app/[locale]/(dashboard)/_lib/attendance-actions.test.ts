import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  config: { findFirst: vi.fn() },
  classPeriod: { findFirst: vi.fn() },
  event: { findMany: vi.fn() },
  classPeriodTeacher: { findFirst: vi.fn() },
  classScheduleSlot: { findFirst: vi.fn() },
  classAssignment: { findMany: vi.fn() },
  attendanceSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceEntry: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  },
  absenceReason: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ db }))
vi.mock('./auth-helper', () => ({
  requireSchoolSession: vi.fn(),
  requireTeacher: vi.fn(),
  requireSchoolAdmin: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const syncMeals = vi.fn()
vi.mock('@/use-cases/meals/sync-meal-absences-from-attendance', () => ({
  syncMealAbsencesFromAttendance: syncMeals,
}))
const auth = await import('./auth-helper')
const actions = await import('./attendance-actions')
const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.requireSchoolSession).mockResolvedValue({
    schoolId: 's',
    userId: 'u',
    isSuperAdmin: false,
    roles: ['ADMIN'],
  } as never)
  vi.mocked(auth.requireSchoolAdmin).mockResolvedValue({
    schoolId: 's',
    userId: 'u',
    isSuperAdmin: false,
  })
  db.config.findFirst.mockResolvedValue({ value: 'true' })
  db.classPeriod.findFirst.mockResolvedValue({ id })
  db.event.findMany.mockResolvedValue([])
  db.classScheduleSlot.findFirst.mockResolvedValue({ id })
  db.classAssignment.findMany.mockResolvedValue([])
  db.attendanceEntry.count.mockResolvedValue(0)
  db.absenceReason.findFirst.mockResolvedValue(null)
  db.attendanceSession.create.mockResolvedValue({ id, status: 'DRAFT', entries: [] })
  db.attendanceSession.findUnique.mockReset().mockResolvedValue(null)
  db.attendanceSession.findFirst.mockResolvedValue({
    status: 'DRAFT',
    statusBeforeCancellation: null,
    _count: { entries: 1 },
  })
  db.$transaction.mockImplementation((callback) =>
    callback({
      classAssignment: db.classAssignment,
      attendanceSession: db.attendanceSession,
      attendanceEntry: db.attendanceEntry,
    })
  )
})
describe('attendance actions', () => {
  it('creates a school-scoped cancelled occurrence', async () => {
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    db.attendanceSession.create.mockResolvedValue({})
    const result = await actions.cancelAttendanceOccurrenceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })
    expect(result).toBe('OK')
    expect(db.attendanceSession.create).toHaveBeenCalled()
  })

  it('rejects an occurrence slot outside the actor school/class', async () => {
    db.classScheduleSlot.findFirst.mockResolvedValue(null)
    await expect(
      actions.cancelAttendanceOccurrenceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).resolves.toBe('notFound')
  })

  it('validates cancellation boolean and scopes cancel/restore update to school', async () => {
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: true })
    ).resolves.toBe('OK')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].where.schoolId).toBe('s')
    expect(syncMeals).toHaveBeenCalledWith({ schoolId: 's', sessionId: id, recordedById: 'u' })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: 'yes' } as never)
    ).resolves.toBe('validationError')
  })

  it('deletes an empty cancelled placeholder on restore', async () => {
    db.attendanceSession.findFirst.mockResolvedValue({
      status: 'CANCELLED',
      statusBeforeCancellation: null,
      _count: { entries: 0 },
    })
    db.attendanceSession.deleteMany.mockResolvedValue({ count: 1 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
    ).resolves.toBe('OK')
    expect(db.attendanceSession.deleteMany).toHaveBeenCalled()
  })

  it.each(['DRAFT', 'VALIDATED'] as const)('restores the saved %s status', async (status) => {
    db.attendanceSession.findFirst.mockResolvedValue({
      status: 'CANCELLED',
      statusBeforeCancellation: status,
      _count: { entries: 2 },
    })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
    ).resolves.toBe('OK')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].data.status).toBe(status)
  })

  it('refuses opening an existing cancelled occurrence without upserting it again', async () => {
    db.classAssignment.findMany.mockResolvedValue([])
    db.attendanceSession.findUnique.mockResolvedValue({ status: 'CANCELLED' })
    await expect(
      actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).resolves.toBe('sessionCancelled')
    expect(db.attendanceSession.create).not.toHaveBeenCalled()
  })
  it('rejects disabled module and foreign slot', async () => {
    db.config.findFirst.mockResolvedValue({ value: 'false' })
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('attendanceDisabled')
    db.config.findFirst.mockResolvedValue({ value: 'true' })
    db.classScheduleSlot.findFirst.mockResolvedValue(null)
    expect(
      await actions.startScheduledAttendanceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).toBe('notFound')
  })
  it('refuses creating a planned occurrence on a published closure', async () => {
    db.event.findMany.mockResolvedValue([
      {
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: null,
      },
    ])
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    await expect(
      actions.startScheduledAttendanceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).resolves.toBe('attendanceClosed')
  })
  it('uses distinct logical occurrence keys for adhoc and a valid schedule slot', async () => {
    await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    expect(db.attendanceSession.create.mock.calls[0][0].data.occurrenceKey).toBe('adhoc')
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    await actions.startScheduledAttendanceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })
    expect(db.classScheduleSlot.findFirst).toHaveBeenCalledWith({
      where: { id, schoolId: 's', classPeriodId: id, weekday: 4 },
      select: { id: true },
    })
    expect(db.attendanceSession.create.mock.calls[1][0].data.occurrenceKey).toBe(id)
  })
  it('inherits entry tenant scope from the parent attendance session', async () => {
    db.classAssignment.findMany.mockResolvedValue([
      {
        enrollment: {
          studentId: 'student-1',
          student: { person: { lastname: 'Benali', name: 'Yasmine' } },
        },
      },
    ])

    await actions.startScheduledAttendanceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })

    expect(db.attendanceSession.create.mock.calls[0][0].data.entries.create).toEqual([
      {
        status: 'PRESENT',
        studentId: 'student-1',
        studentName: 'Benali Yasmine',
        updatedById: 'u',
      },
    ])
  })
  it('creates nested roster entries without the parent school id', async () => {
    db.classAssignment.findMany.mockResolvedValue([
      { enrollment: { studentId: 'student-1', student: { person: { lastname: 'A', name: 'B' } } } },
    ])
    await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    const entry = db.attendanceSession.create.mock.calls[0][0].data.entries.create[0]
    expect(entry).toEqual({
      status: 'PRESENT',
      studentId: 'student-1',
      studentName: 'A B',
      updatedById: 'u',
    })
    expect(entry).not.toHaveProperty('schoolId')
  })
  it('denies an unassigned teacher before opening a class in this tenant', async () => {
    vi.mocked(auth.requireSchoolSession).mockResolvedValue({
      schoolId: 's',
      userId: 'teacher-user',
      isSuperAdmin: false,
      roles: ['TEACHER'],
    } as never)
    vi.mocked(auth.requireTeacher).mockResolvedValue({
      schoolId: 's',
      userId: 'teacher-user',
      teacherId: 'teacher-1',
    })
    db.classPeriodTeacher.findFirst.mockResolvedValue(null)
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('notFound')
    expect(db.attendanceSession.create).not.toHaveBeenCalled()
  })
  it('does not report missing entry as updated', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({ schoolId: 's', classPeriodId: id })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 0 })
    expect(
      await actions.updateAttendanceEntryAction({ sessionId: id, entryId: id, status: 'PRESENT' })
    ).toBe('notFound')
  })

  it('updates a late entry atomically with optional minutes and message', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })

    await expect(
      actions.updateAttendanceEntryAction({
        sessionId: id,
        entryId: id,
        status: 'LATE',
        lateMinutes: 15,
        message: 'Bus delayed',
      })
    ).resolves.toBe('OK')

    expect(db.attendanceEntry.updateMany).toHaveBeenCalledTimes(1)
    expect(db.attendanceEntry.updateMany.mock.calls[0][0]).toMatchObject({
      data: { status: 'LATE', lateMinutes: 15, message: 'Bus delayed', updatedById: 'u' },
    })
  })

  it('clears late minutes but preserves an omitted message on a non-late update', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })

    await actions.updateAttendanceEntryAction({ sessionId: id, entryId: id, status: 'PRESENT' })

    expect(db.attendanceEntry.updateMany.mock.calls[0][0].data).toEqual({
      status: 'PRESENT',
      lateMinutes: null,
      absenceReasonId: null,
      absenceReasonLabel: null,
      updatedById: 'u',
    })
  })

  it.each([0, 1440])('accepts %i as a late-minute boundary', async (lateMinutes) => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })

    await expect(
      actions.updateAttendanceEntryAction({
        sessionId: id,
        entryId: id,
        status: 'LATE',
        lateMinutes,
      })
    ).resolves.toBe('OK')

    expect(db.attendanceEntry.updateMany.mock.calls[0][0].data.lateMinutes).toBe(lateMinutes)
  })

  it('allows an explicit null message to clear it', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })

    await actions.updateAttendanceEntryAction({
      sessionId: id,
      entryId: id,
      status: 'LATE',
      lateMinutes: null,
      message: null,
    })

    expect(db.attendanceEntry.updateMany.mock.calls[0][0].data).toEqual({
      status: 'LATE',
      lateMinutes: null,
      message: null,
      absenceReasonId: null,
      absenceReasonLabel: null,
      updatedById: 'u',
    })
  })

  it.each([
    { lateMinutes: -1 },
    { lateMinutes: 1441 },
    { lateMinutes: 1.5 },
    { message: 'x'.repeat(1001) },
  ])('rejects invalid optional late-entry data: %o', async (invalid) => {
    await expect(
      actions.updateAttendanceEntryAction({
        sessionId: id,
        entryId: id,
        status: 'LATE',
        ...invalid,
      })
    ).resolves.toBe('validationError')
    expect(db.attendanceEntry.updateMany).not.toHaveBeenCalled()
  })

  it('does not look up or update an entry outside the active school', async () => {
    db.attendanceSession.findUnique.mockReset().mockResolvedValue(null)

    await expect(
      actions.updateAttendanceEntryAction({ sessionId: id, entryId: id, status: 'LATE' })
    ).resolves.toBe('notFound')

    expect(db.attendanceEntry.updateMany).not.toHaveBeenCalled()
  })

  it('reloads an existing session after a concurrent unique conflict', async () => {
    db.attendanceSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id, status: 'DRAFT', entries: [] })
    db.attendanceSession.create.mockRejectedValueOnce({ code: 'P2002' })
    await expect(
      actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).resolves.toMatchObject({ id })
    expect(db.attendanceSession.create).toHaveBeenCalledTimes(1)
  })

  it('preserves the previous status when cancelling an existing session', async () => {
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    db.attendanceSession.findUnique.mockResolvedValue({ id, status: 'VALIDATED' })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    await expect(
      actions.cancelAttendanceOccurrenceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).resolves.toBe('OK')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      statusBeforeCancellation: 'VALIDATED',
    })
  })
  it('marks only unrecorded entries and validates with actor', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({ schoolId: 's', classPeriodId: id })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })
    await actions.markAllPresentAction({ sessionId: id })
    expect(db.attendanceEntry.updateMany.mock.calls[0][0].where.status).toBe('NOT_RECORDED')
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    expect(await actions.validateAttendanceAction({ sessionId: id })).toBe('OK')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].data.updatedById).toBe('u')
    expect(syncMeals).toHaveBeenCalledWith({ schoolId: 's', sessionId: id, recordedById: 'u' })
    expect(db.attendanceSession.updateMany.mock.calls[0][0].where).toEqual({
      id,
      schoolId: 's',
      status: { in: ['DRAFT', 'VALIDATED'] },
    })
  })

  it('refuses validating a session cancelled after it was read', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(actions.validateAttendanceAction({ sessionId: id })).resolves.toBe(
      'invalidTransition'
    )
    expect(syncMeals).not.toHaveBeenCalled()
  })

  it('includes a student assigned to the class during the occurrence day', async () => {
    await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    const where = db.classAssignment.findMany.mock.calls[0][0].where
    expect(where.schoolId).toBe('s')
    expect(where.startAt).toEqual({ lt: new Date('2026-01-02T00:00:00.000Z') })
    expect(where.OR).toEqual([
      { endAt: null },
      { endAt: { gte: new Date('2026-01-01T00:00:00.000Z') } },
    ])
  })
})

describe('refreshAttendanceRosterAction', () => {
  const assignment = (studentId: string) => ({
    enrollment: { studentId, student: { person: { lastname: studentId, name: 'X' } } },
  })
  beforeEach(() => {
    db.attendanceSession.findUnique
      .mockResolvedValueOnce({ schoolId: 's', classPeriodId: id, status: 'DRAFT' })
      .mockResolvedValueOnce({
        status: 'DRAFT',
        classPeriodId: id,
        occurredOn: new Date('2026-01-01T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({ id, status: 'DRAFT', entries: [] })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    db.classAssignment.findMany.mockResolvedValue([assignment('old'), assignment('new')])
    db.attendanceEntry.findMany.mockResolvedValue([{ studentId: 'old' }])
    db.attendanceEntry.createMany.mockResolvedValue({ count: 1 })
  })

  it('adds only the students assigned since the opening, present by default, to a draft session', async () => {
    await expect(actions.refreshAttendanceRosterAction({ sessionId: id })).resolves.toMatchObject({
      id,
    })
    expect(db.attendanceSession.updateMany.mock.calls[0][0].where).toEqual({
      id,
      schoolId: 's',
      status: 'DRAFT',
    })
    expect(db.attendanceEntry.findMany.mock.calls[0][0].where).toEqual({
      attendanceSessionId: id,
      schoolId: 's',
    })
    expect(db.classAssignment.findMany.mock.calls[0][0].where.startAt).toEqual({
      lt: new Date('2026-01-02T00:00:00.000Z'),
    })
    expect(db.attendanceEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          status: 'PRESENT',
          studentId: 'new',
          studentName: 'new X',
          schoolId: 's',
          attendanceSessionId: id,
          updatedById: 'u',
        },
      ],
      skipDuplicates: true,
    })
  })

  it('refuses a validated session without touching its entries', async () => {
    db.attendanceSession.findUnique.mockReset()
    db.attendanceSession.findUnique
      .mockResolvedValueOnce({ schoolId: 's', classPeriodId: id, status: 'VALIDATED' })
      .mockResolvedValueOnce({ status: 'VALIDATED', classPeriodId: id, occurredOn: new Date() })
    await expect(actions.refreshAttendanceRosterAction({ sessionId: id })).resolves.toBe(
      'invalidTransition'
    )
    expect(db.attendanceSession.updateMany).not.toHaveBeenCalled()
    expect(db.attendanceEntry.createMany).not.toHaveBeenCalled()
  })

  it('refuses when the session is validated concurrently', async () => {
    db.attendanceSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(actions.refreshAttendanceRosterAction({ sessionId: id })).resolves.toBe(
      'invalidTransition'
    )
    expect(db.attendanceEntry.createMany).not.toHaveBeenCalled()
  })

  it('refuses when attendance is disabled', async () => {
    db.config.findFirst.mockResolvedValue({ value: 'false' })
    await expect(actions.refreshAttendanceRosterAction({ sessionId: id })).resolves.toBe('notFound')
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('attendance cancellation transitions', () => {
  it.each(['DRAFT', 'VALIDATED'] as const)(
    'refuses restoring a %s session without writing',
    async (status) => {
      db.attendanceSession.findFirst.mockResolvedValue({
        status,
        statusBeforeCancellation: null,
        _count: { entries: 2 },
      })
      await expect(
        actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
      ).resolves.toBe('invalidTransition')
      expect(db.attendanceSession.updateMany).not.toHaveBeenCalled()
      expect(db.attendanceSession.deleteMany).not.toHaveBeenCalled()
    }
  )

  it('restores only while the session is still cancelled', async () => {
    db.attendanceSession.findFirst.mockResolvedValue({
      status: 'CANCELLED',
      statusBeforeCancellation: 'VALIDATED',
      _count: { entries: 2 },
    })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
    ).resolves.toBe('invalidTransition')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].where).toEqual({
      id,
      schoolId: 's',
      status: 'CANCELLED',
      statusBeforeCancellation: 'VALIDATED',
    })
  })

  it('cancels only while the session keeps the status that was read', async () => {
    db.attendanceSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: true })
    ).resolves.toBe('invalidTransition')
    expect(db.attendanceSession.updateMany.mock.calls[0][0].where).toEqual({
      id,
      schoolId: 's',
      status: 'DRAFT',
    })
  })

  it('deletes a placeholder only if it is still empty and cancelled', async () => {
    db.attendanceSession.findFirst.mockResolvedValue({
      status: 'CANCELLED',
      statusBeforeCancellation: null,
      _count: { entries: 0 },
    })
    db.attendanceSession.deleteMany.mockResolvedValue({ count: 0 })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
    ).resolves.toBe('invalidTransition')
    expect(db.attendanceSession.deleteMany.mock.calls[0][0].where).toEqual({
      id,
      schoolId: 's',
      status: 'CANCELLED',
      statusBeforeCancellation: null,
      entries: { none: {} },
    })
  })

  it('refuses both cancellation actions when attendance is disabled', async () => {
    db.config.findFirst.mockResolvedValue({ value: 'false' })
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: true })
    ).resolves.toBe('attendanceDisabled')
    await expect(
      actions.setAttendanceCancellationAction({ sessionId: id, cancelled: false })
    ).resolves.toBe('attendanceDisabled')
    await expect(
      actions.cancelAttendanceOccurrenceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).resolves.toBe('attendanceDisabled')
    expect(db.attendanceSession.findFirst).not.toHaveBeenCalled()
    expect(db.attendanceSession.updateMany).not.toHaveBeenCalled()
    expect(db.attendanceSession.deleteMany).not.toHaveBeenCalled()
    expect(db.attendanceSession.create).not.toHaveBeenCalled()
  })

  it('cancels an occurrence opened concurrently instead of reporting a false success', async () => {
    db.attendanceSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id, status: 'DRAFT' })
    db.attendanceSession.create.mockRejectedValueOnce({ code: 'P2002' })
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })
    await expect(
      actions.cancelAttendanceOccurrenceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).resolves.toBe('OK')
    expect(db.attendanceSession.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id, schoolId: 's', status: 'DRAFT' },
      data: { status: 'CANCELLED', statusBeforeCancellation: 'DRAFT' },
    })
  })
})

describe('per-slot attendance compatibility', () => {
  it('preserves exceptional adhoc opening on a closed day in per-slot mode', async () => {
    db.event.findMany.mockResolvedValue([
      { category: 'CLOSURE', status: 'PUBLISHED', startAt: new Date('2026-01-01'), endAt: null },
    ])
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toMatchObject({ id })
    expect(db.event.findMany).not.toHaveBeenCalled()
  })

  it('keeps lesson and adhoc identities separate by default', async () => {
    await actions.startScheduledAttendanceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })
    expect(db.attendanceSession.create.mock.calls[0][0].data).toMatchObject({
      classScheduleSlotId: id,
      occurrenceKey: id,
    })
    await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    expect(db.attendanceSession.create.mock.calls[1][0].data).toMatchObject({
      classScheduleSlotId: null,
      occurrenceKey: 'adhoc',
    })
  })
})

describe('daily attendance identity', () => {
  beforeEach(() => {
    db.config.findFirst.mockImplementation(async ({ where }) => ({
      value: where.name === 'attendance_frequency' ? 'DAILY' : 'true',
    }))
  })

  it('opens all same-day lesson links and adhoc calls with one daily key and no stored lesson', async () => {
    const secondSlot = '00000000-0000-4000-8000-000000000002'
    let stored: unknown = null
    db.attendanceSession.findUnique.mockImplementation(async () => stored)
    db.attendanceSession.create.mockImplementation(async ({ data }) => {
      stored = { id, status: 'DRAFT', entries: [], ...data }
      return stored
    })
    const input = { classPeriodId: id, occurredOn: '2026-01-01' }
    const first = await actions.startScheduledAttendanceAction({
      ...input,
      classScheduleSlotId: id,
    })
    expect(
      await actions.startScheduledAttendanceAction({ ...input, classScheduleSlotId: secondSlot })
    ).toEqual(first)
    expect(await actions.startAdhocAttendanceAction(input)).toEqual(first)
    expect(db.attendanceSession.create).toHaveBeenCalledTimes(1)
    expect(db.attendanceSession.create.mock.calls[0][0].data).toMatchObject({
      occurrenceKey: 'daily',
      classScheduleSlotId: null,
    })
    for (const [query] of db.attendanceSession.findUnique.mock.calls) {
      expect(query.where.schoolId_classPeriodId_occurredOn_occurrenceKey).toMatchObject({
        schoolId: 's',
        classPeriodId: id,
        occurrenceKey: 'daily',
      })
    }
  })

  it('uses the canonical daily key for concurrent creation recovery', async () => {
    db.attendanceSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id, status: 'DRAFT', entries: [] })
    db.attendanceSession.create.mockRejectedValueOnce({ code: 'P2002' })
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toMatchObject({ id })
    expect(
      db.attendanceSession.findUnique.mock.calls[1][0].where
        .schoolId_classPeriodId_occurredOn_occurrenceKey.occurrenceKey
    ).toBe('daily')
  })

  it('cancels the day as a whole and blocks reopening through another lesson or adhoc', async () => {
    const cancelled = { id, status: 'CANCELLED', entries: [] }
    db.attendanceSession.create.mockResolvedValue(cancelled)
    expect(
      await actions.cancelAttendanceOccurrenceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).toBe('OK')
    expect(db.attendanceSession.create.mock.calls[0][0].data).toMatchObject({
      occurrenceKey: 'daily',
      classScheduleSlotId: null,
      status: 'CANCELLED',
    })
    db.attendanceSession.findUnique.mockResolvedValue(cancelled)
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('sessionCancelled')
  })

  it('refuses daily opening without a lesson on a published closure', async () => {
    db.event.findMany.mockResolvedValue([
      { category: 'CLOSURE', status: 'PUBLISHED', startAt: new Date('2026-01-01'), endAt: null },
    ])
    expect(
      await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('attendanceClosed')
    expect(db.attendanceSession.create).not.toHaveBeenCalled()
    expect(db.classScheduleSlot.findFirst).not.toHaveBeenCalled()
    expect(db.event.findMany.mock.calls[0][0].where.schoolId).toBe('s')
  })

  it('still refuses a foreign lesson and school closures before creating a daily call', async () => {
    db.classScheduleSlot.findFirst.mockResolvedValue(null)
    expect(
      await actions.startScheduledAttendanceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).toBe('notFound')
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    db.event.findMany.mockResolvedValue([
      { category: 'CLOSURE', status: 'PUBLISHED', startAt: new Date('2026-01-01'), endAt: null },
    ])
    expect(
      await actions.startScheduledAttendanceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).toBe('attendanceClosed')
    expect(db.attendanceSession.create).not.toHaveBeenCalled()
  })
})

describe('absence reasons on attendance entries', () => {
  const reasonId = '00000000-0000-4000-8000-000000000002'
  beforeEach(() => {
    db.attendanceSession.findUnique.mockResolvedValue({
      schoolId: 's',
      classPeriodId: id,
      status: 'DRAFT',
    })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 1 })
  })

  it('stores the reason id and a snapshot of its label on an absence', async () => {
    db.absenceReason.findFirst.mockResolvedValue({ id: reasonId, label: 'Maladie' })

    await expect(
      actions.updateAttendanceEntryAction({
        sessionId: id,
        entryId: id,
        status: 'ABSENT',
        absenceReasonId: reasonId,
      })
    ).resolves.toBe('OK')

    expect(db.absenceReason.findFirst.mock.calls[0][0].where).toEqual({
      id: reasonId,
      schoolId: 's',
    })
    expect(db.attendanceEntry.updateMany.mock.calls[0][0].data).toMatchObject({
      absenceReasonId: reasonId,
      absenceReasonLabel: 'Maladie',
    })
  })

  it('refuses a reason that is not an active reason of the caller school', async () => {
    db.absenceReason.findFirst.mockResolvedValue(null)

    await expect(
      actions.updateAttendanceEntryAction({
        sessionId: id,
        entryId: id,
        status: 'ABSENT',
        absenceReasonId: reasonId,
      })
    ).resolves.toBe('absenceReasonNotFound')
    expect(db.attendanceEntry.updateMany).not.toHaveBeenCalled()
  })

  it('keeps the current reason when an absence update omits it', async () => {
    await actions.updateAttendanceEntryAction({ sessionId: id, entryId: id, status: 'ABSENT' })

    expect(db.absenceReason.findFirst).not.toHaveBeenCalled()
    const data = db.attendanceEntry.updateMany.mock.calls[0][0].data
    expect(data).not.toHaveProperty('absenceReasonId')
    expect(data).not.toHaveProperty('absenceReasonLabel')
  })

  it('clears the reason with an explicit null', async () => {
    await actions.updateAttendanceEntryAction({
      sessionId: id,
      entryId: id,
      status: 'ABSENT',
      absenceReasonId: null,
    })

    expect(db.attendanceEntry.updateMany.mock.calls[0][0].data).toMatchObject({
      absenceReasonId: null,
      absenceReasonLabel: null,
    })
  })

  it('blocks validation while a school-scoped absence has no reason and one is required', async () => {
    db.config.findFirst.mockResolvedValue({ value: 'true' })
    db.attendanceEntry.count.mockResolvedValue(2)

    await expect(actions.validateAttendanceAction({ sessionId: id })).resolves.toBe(
      'absenceReasonMissing'
    )
    expect(db.attendanceEntry.count.mock.calls[0][0].where).toEqual({
      attendanceSessionId: id,
      schoolId: 's',
      status: 'ABSENT',
      absenceReasonId: null,
    })
    expect(db.attendanceSession.updateMany).not.toHaveBeenCalled()
  })

  it('validates absences without reasons when the school does not require one', async () => {
    db.config.findFirst.mockImplementation(async ({ where }) => ({
      value: where.name === 'attendance_absence_reason_required' ? 'false' : 'true',
    }))
    db.attendanceSession.updateMany.mockResolvedValue({ count: 1 })

    await expect(actions.validateAttendanceAction({ sessionId: id })).resolves.toBe('OK')
    expect(db.attendanceEntry.count).not.toHaveBeenCalled()
  })
})
