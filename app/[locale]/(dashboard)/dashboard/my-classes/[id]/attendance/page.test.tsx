import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const frequencyMock = vi.hoisted(() => vi.fn(() => Promise.resolve('PER_SLOT')))
vi.mock('@/use-cases/config/get-attendance-frequency', () => ({
  getAttendanceFrequency: frequencyMock,
}))

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
  frequencyMock.mockResolvedValue('PER_SLOT')
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

it.each(['slot-1', undefined])(
  'reads the canonical daily session from any daily entrypoint (%s)',
  async (slotId) => {
    frequencyMock.mockResolvedValue('DAILY')
    render(
      await AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', slotId }),
      })
    )
    expect(dbMock.attendanceSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId_classPeriodId_occurredOn_occurrenceKey: {
            schoolId: 'school-1',
            classPeriodId: 'class-1',
            occurredOn: new Date('2026-09-17T00:00:00.000Z'),
            occurrenceKey: 'daily',
          },
        },
      })
    )
    expect(screen.getByTestId('attendance-panel')).not.toHaveAttribute('data-slot-id')
  }
)

it('reads historical slot sessions explicitly after switching to daily frequency', async () => {
  frequencyMock.mockResolvedValue('DAILY')
  await AttendancePage({
    params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
    searchParams: Promise.resolve({
      date: '2026-09-17',
      slotId: 'slot-1',
      occurrence: 'historical',
    }),
  })
  expect(
    dbMock.attendanceSession.findUnique.mock.calls[0][0].where
      .schoolId_classPeriodId_occurredOn_occurrenceKey.occurrenceKey
  ).toBe('slot-1')
})

it.each(['historical', 'daily'])(
  'does not create missing historical %s calls in per-slot mode',
  async (occurrence) => {
    dbMock.attendanceSession.findUnique.mockResolvedValue(null)
    dbMock.event.findMany.mockResolvedValue([])
    await expect(
      AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-17', occurrence }),
      })
    ).rejects.toThrow('notFound')
  }
)

it('reads an existing daily call after returning to per-slot frequency', async () => {
  render(
    await AttendancePage({
      params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
      searchParams: Promise.resolve({ date: '2026-09-17', occurrence: 'daily' }),
    })
  )
  expect(screen.getByTestId('attendance-panel')).toHaveAttribute('data-session-id', 'session-1')
  expect(
    dbMock.attendanceSession.findUnique.mock.calls[0][0].where
      .schoolId_classPeriodId_occurredOn_occurrenceKey.occurrenceKey
  ).toBe('daily')
})
