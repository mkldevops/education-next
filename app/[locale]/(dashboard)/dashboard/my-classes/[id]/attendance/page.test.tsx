import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  config: { findFirst: vi.fn() },
  classPeriod: { findFirst: vi.fn() },
  attendanceSession: { findUnique: vi.fn() },
}
const requireSchoolSessionMock = vi.fn()
const requireTeacherMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found')
  }),
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
    occurredOn,
    classScheduleSlotId,
    initialSession,
  }: {
    occurredOn: string
    classScheduleSlotId: string
    initialSession?: { id: string }
  }) => (
    <div
      data-testid="attendance-panel"
      data-date={occurredOn}
      data-slot={classScheduleSlotId}
      data-session={initialSession?.id}
    />
  ),
}))

const { default: AttendancePage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'admin-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  })
  requireTeacherMock.mockRejectedValue(new Error('teacher access should not be required'))
  dbMock.config.findFirst.mockResolvedValue({ value: 'true' })
  dbMock.classPeriod.findFirst.mockResolvedValue({ id: 'class-1', name: 'CP-A' })
  dbMock.attendanceSession.findUnique.mockResolvedValue(null)
})

describe('AttendancePage', () => {
  it('allows an administrator to open a scheduled occurrence in the active school', async () => {
    const page = AttendancePage as unknown as (props: {
      params: Promise<{ locale: string; id: string }>
      searchParams: Promise<{ date?: string; slotId?: string }>
    }) => Promise<React.ReactNode>

    render(
      await page({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({
          date: '2026-09-14',
          slotId: '00000000-0000-4000-8000-000000000002',
        }),
      })
    )

    expect(requireTeacherMock).not.toHaveBeenCalled()
    expect(dbMock.classPeriod.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'class-1',
        schoolId: 'school-1',
        scheduleSlots: {
          some: { id: '00000000-0000-4000-8000-000000000002', weekday: 1 },
        },
      },
      select: { id: true, name: true },
    })
    expect(screen.getByTestId('attendance-panel')).toHaveAttribute('data-date', '2026-09-14')
    expect(screen.getByTestId('attendance-panel')).toHaveAttribute(
      'data-slot',
      '00000000-0000-4000-8000-000000000002'
    )
  })

  it('refuses opening attendance without a selected schedule slot', async () => {
    await expect(
      AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({ date: '2026-09-14' }),
      })
    ).rejects.toThrow('not found')
    expect(dbMock.classPeriod.findFirst).not.toHaveBeenCalled()
  })

  it('loads an existing occurrence for immediate consultation', async () => {
    dbMock.attendanceSession.findUnique.mockResolvedValue({
      id: 'session-1',
      status: 'VALIDATED',
      entries: [],
    })

    render(
      await AttendancePage({
        params: Promise.resolve({ locale: 'fr', id: 'class-1' }),
        searchParams: Promise.resolve({
          date: '2026-09-14',
          slotId: '00000000-0000-4000-8000-000000000002',
        }),
      })
    )

    expect(screen.getByTestId('attendance-panel')).toHaveAttribute('data-session', 'session-1')
  })
})
