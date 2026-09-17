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
  attendanceEntry: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ db }))
vi.mock('./auth-helper', () => ({
  requireSchoolSession: vi.fn(),
  requireTeacher: vi.fn(),
  requireSchoolAdmin: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const auth = await import('./auth-helper')
const actions = await import('./attendance-actions')
const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.requireSchoolSession).mockResolvedValue({
    schoolId: 's',
    userId: 'u',
    isSuperAdmin: false,
    role: 'ADMIN',
  } as never)
  vi.mocked(auth.requireSchoolAdmin).mockResolvedValue({
    schoolId: 's',
    userId: 'u',
    isSuperAdmin: false,
  })
  db.config.findFirst.mockResolvedValue({ value: 'true' })
  db.classPeriod.findFirst.mockResolvedValue({ id })
  db.event.findMany.mockResolvedValue([])
  db.classAssignment.findMany.mockResolvedValue([])
  db.attendanceSession.create.mockResolvedValue({ id, status: 'DRAFT', entries: [] })
  db.attendanceSession.findUnique.mockResolvedValue(null)
  db.attendanceSession.findFirst.mockResolvedValue({
    status: 'DRAFT',
    statusBeforeCancellation: null,
    _count: { entries: 1 },
  })
  db.$transaction.mockImplementation((callback) =>
    callback({ classAssignment: db.classAssignment, attendanceSession: db.attendanceSession })
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
    expect(db.attendanceSession.create.mock.calls[1][0].data.occurrenceKey).toBe(id)
  })
  it('creates nested roster entries without the parent school id', async () => {
    db.classAssignment.findMany.mockResolvedValue([
      { enrollment: { studentId: 'student-1', student: { person: { lastname: 'A', name: 'B' } } } },
    ])
    await actions.startAdhocAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    const entry = db.attendanceSession.create.mock.calls[0][0].data.entries.create[0]
    expect(entry).toEqual({ studentId: 'student-1', studentName: 'A B', updatedById: 'u' })
    expect(entry).not.toHaveProperty('schoolId')
  })
  it('denies an unassigned teacher before opening a class in this tenant', async () => {
    vi.mocked(auth.requireSchoolSession).mockResolvedValue({
      schoolId: 's',
      userId: 'teacher-user',
      isSuperAdmin: false,
      role: 'TEACHER',
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
    db.attendanceSession.findUnique.mockResolvedValue(null)

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
  })
})
