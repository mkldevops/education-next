import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  config: { findFirst: vi.fn() },
  classPeriodTeacher: { findFirst: vi.fn() },
  classScheduleSlot: { findFirst: vi.fn() },
  classAssignment: { findMany: vi.fn() },
  attendanceSession: { upsert: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
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
  db.classAssignment.findMany.mockResolvedValue([])
  db.attendanceSession.upsert.mockResolvedValue({ id, entries: [] })
  db.attendanceSession.findUnique.mockResolvedValue(null)
  db.$transaction.mockImplementation((callback) =>
    callback({ classAssignment: db.classAssignment, attendanceSession: db.attendanceSession })
  )
})
describe('attendance actions', () => {
  it('upserts a school-scoped cancelled occurrence', async () => {
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    db.attendanceSession.upsert.mockResolvedValue({})
    const result = await actions.cancelAttendanceOccurrenceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })
    expect(result).toBe('OK')
    expect(db.attendanceSession.upsert).toHaveBeenCalled()
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

  it('refuses opening an existing cancelled occurrence without upserting it again', async () => {
    db.classAssignment.findMany.mockResolvedValue([])
    db.attendanceSession.findUnique.mockResolvedValue({ status: 'CANCELLED' })
    await expect(
      actions.openAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).resolves.toBe('sessionCancelled')
    expect(db.attendanceSession.upsert).not.toHaveBeenCalled()
  })
  it('rejects disabled module and foreign slot', async () => {
    db.config.findFirst.mockResolvedValue({ value: 'false' })
    expect(
      await actions.openAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('attendanceDisabled')
    db.config.findFirst.mockResolvedValue({ value: 'true' })
    db.classScheduleSlot.findFirst.mockResolvedValue(null)
    expect(
      await actions.openAttendanceAction({
        classPeriodId: id,
        classScheduleSlotId: id,
        occurredOn: '2026-01-01',
      })
    ).toBe('notFound')
  })
  it('uses distinct logical occurrence keys for adhoc and a valid schedule slot', async () => {
    await actions.openAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    expect(
      db.attendanceSession.upsert.mock.calls[0][0].where
        .schoolId_classPeriodId_occurredOn_occurrenceKey.occurrenceKey
    ).toBe('adhoc')
    db.classScheduleSlot.findFirst.mockResolvedValue({ id })
    await actions.openAttendanceAction({
      classPeriodId: id,
      classScheduleSlotId: id,
      occurredOn: '2026-01-01',
    })
    expect(
      db.attendanceSession.upsert.mock.calls[1][0].where
        .schoolId_classPeriodId_occurredOn_occurrenceKey.occurrenceKey
    ).toBe(id)
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
      await actions.openAttendanceAction({ classPeriodId: id, occurredOn: '2026-01-01' })
    ).toBe('notFound')
    expect(db.attendanceSession.upsert).not.toHaveBeenCalled()
  })
  it('does not report missing entry as updated', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({ schoolId: 's', classPeriodId: id })
    db.attendanceEntry.updateMany.mockResolvedValue({ count: 0 })
    expect(
      await actions.updateAttendanceEntryAction({ sessionId: id, entryId: id, status: 'PRESENT' })
    ).toBe('notFound')
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
