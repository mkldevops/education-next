import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../../../messages/en.json'
import fr from '../../../../../messages/fr.json'

const dbMock = {
  config: { findFirst: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
  attendanceSession: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
  classPeriod: { findMany: vi.fn() },
  teacher: { findMany: vi.fn() },
}
const requireSchoolSessionMock = vi.fn()
const getSelectedPeriodMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('../../_lib/auth-helper', () => ({
  requireSchoolSession: requireSchoolSessionMock,
  requireTeacher: vi.fn(),
}))
vi.mock('./_components/cancel-attendance-form', () => ({
  CancelAttendanceForm: ({ label }: { label: string }) => <button type="button">{label}</button>,
  CancelOccurrenceForm: ({ label }: { label: string }) => <button type="button">{label}</button>,
}))

const { default: AttendanceTrackingPage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  })
  getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026-2027' })
  dbMock.config.findFirst.mockResolvedValue({ value: 'true' })
  dbMock.classScheduleSlot.findMany.mockResolvedValue([
    {
      id: 'slot-1',
      classPeriodId: 'class-1',
      weekday: 1,
      classPeriod: { name: 'CP-A' },
    },
  ])
  dbMock.attendanceSession.findMany.mockResolvedValue([])
  dbMock.event.findMany.mockResolvedValue([])
  dbMock.classPeriod.findMany.mockResolvedValue([{ id: 'class-1', name: 'CP-A' }])
  dbMock.teacher.findMany.mockResolvedValue([
    { id: 'teacher-1', firstName: 'Amina', lastName: 'Benali' },
  ])
})

describe('AttendanceTrackingPage', () => {
  it('renders a structured admin dashboard without adding a nested main landmark', async () => {
    const { container } = render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({ date: '2026-09-14' }),
      })
    )

    expect(container.querySelector('main')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'trackingTitle' })).toHaveClass('text-2xl')
    expect(screen.getByLabelText('date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('class')).toHaveValue('')
    expect(screen.getByLabelText('teacher')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'applyFilters' })).toHaveClass('h-10')
    expect(screen.getByText('notStarted')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'takeAttendance' })).toHaveAttribute(
      'href',
      '/dashboard/my-classes/class-1/attendance?date=2026-09-14&slotId=slot-1'
    )
    expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument()
  })

  it('uses the shared empty-state presentation when no call is expected', async () => {
    dbMock.classScheduleSlot.findMany.mockResolvedValue([])

    const { container } = render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({ date: '2026-09-17' }),
      })
    )

    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(container.querySelector('.border-dashed')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'takeAttendanceFor' })).not.toBeInTheDocument()
  })

  it('keeps the new dashboard copy aligned in French and English', () => {
    expect(fr.dashboard.pages.attendance).toMatchObject({
      description: expect.any(String),
      expectedCalls: expect.any(String),
      cancelledCalls: expect.any(String),
      takeAttendance: expect.any(String),
      resumeAttendance: expect.any(String),
      reviewAttendance: expect.any(String),
      takeAttendanceFor: expect.any(String),
    })
    expect(en.dashboard.pages.attendance).toMatchObject({
      description: expect.any(String),
      expectedCalls: expect.any(String),
      cancelledCalls: expect.any(String),
      takeAttendance: expect.any(String),
      resumeAttendance: expect.any(String),
      reviewAttendance: expect.any(String),
      takeAttendanceFor: expect.any(String),
    })
  })
})
