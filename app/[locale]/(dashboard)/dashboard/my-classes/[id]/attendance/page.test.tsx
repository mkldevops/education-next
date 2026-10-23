import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  config: { findFirst: vi.fn() },
  classPeriod: { findFirst: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
  attendanceSession: { findUnique: vi.fn() },
}
const requireSchoolSessionMock = vi.fn()
const requireTeacherMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('../../../../_lib/auth-helper', () => ({
  requireSchoolSession: requireSchoolSessionMock,
  requireTeacher: requireTeacherMock,
}))
vi.mock('./_components/attendance-panel', () => ({
  AttendancePanel: ({
    initialSession,
    selectedSlotId,
    returnHref,
    labels,
  }: {
    initialSession: { id: string } | null
    selectedSlotId?: string
    returnHref: string
    labels: { returnClasses: string }
  }) => (
    <div
      data-testid="attendance-panel"
      data-session-id={initialSession?.id}
      data-slot-id={selectedSlotId}
      data-return-href={returnHref}
      data-return-label={labels.returnClasses}
    />
  ),
}))

const { default: AttendancePage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'admin-1',
    roles: ['ADMIN'],
    isSuperAdmin: false,
  })
  dbMock.config.findFirst.mockResolvedValue({ value: 'true' })
  dbMock.classPeriod.findFirst.mockResolvedValue({ id: 'class-1', name: 'CP-A' })
  dbMock.classScheduleSlot.findMany.mockResolvedValue([
    { id: 'slot-1', startTime: '09:00', endTime: '10:00' },
  ])
  dbMock.event.findMany.mockResolvedValue([
    {
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date('2026-09-17T00:00:00.000Z'),
      endAt: null,
    },
  ])
  dbMock.attendanceSession.findUnique.mockResolvedValue({
    id: 'session-1',
    status: 'VALIDATED',
    entries: [],
  })
})

describe('AttendancePage', () => {
  it('loads an existing scheduled session even when a closure now hides new slots', async () => {
    render(
      await AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', slotId: 'slot-1' }),
      })
    )

    expect(screen.getByTestId('attendance-panel')).toHaveAttribute('data-session-id', 'session-1')
    expect(screen.getByTestId('attendance-panel')).toHaveAttribute('data-slot-id', 'slot-1')
  })

  it('sends an admin back to the tracking day they came from', async () => {
    render(
      await AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', slotId: 'slot-1' }),
      })
    )

    const panel = screen.getByTestId('attendance-panel')
    expect(panel).toHaveAttribute('data-return-href', '/dashboard/attendance?date=2026-09-17')
    expect(panel).toHaveAttribute('data-return-label', 'returnTracking')
  })

  it('sends a teacher back to their classes', async () => {
    requireSchoolSessionMock.mockResolvedValue({
      schoolId: 'school-1',
      userId: 'teacher-user',
      roles: ['TEACHER'],
      isSuperAdmin: false,
    })
    requireTeacherMock.mockResolvedValue({
      schoolId: 'school-1',
      userId: 'teacher-user',
      teacherId: 'teacher-1',
    })
    render(
      await AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', slotId: 'slot-1' }),
      })
    )

    const panel = screen.getByTestId('attendance-panel')
    expect(panel).toHaveAttribute('data-return-href', '/dashboard/my-classes')
    expect(panel).toHaveAttribute('data-return-label', 'returnClasses')
  })

  it('does not expose a new scheduled session on a closed date', async () => {
    dbMock.attendanceSession.findUnique.mockResolvedValue(null)

    await expect(
      AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', slotId: 'slot-1' }),
      })
    ).rejects.toThrow('notFound')
  })
})
