import { render, screen } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  config: { findFirst: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
  attendanceSession: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
  classPeriod: { findMany: vi.fn() },
  teacher: { findMany: vi.fn() },
}
const getSelectedPeriodMock = vi.fn()
const requireSchoolSessionMock = vi.fn()
const requireTeacherMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
const getSchoolContextMock = vi.fn()
vi.mock('@/lib/school-context', () => ({
  getSchoolContext: getSchoolContextMock,
  isActiveSchoolAdmin: (context: { isSuperAdmin: boolean; role: string | null }) =>
    context.isSuperAdmin || context.role === 'ADMIN',
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('@peaklab/ui', async () => ({
  ...(await vi.importActual<typeof import('@/components/ui/select')>('@/components/ui/select')),
  Breadcrumbs: ({ items }: { items: { label: string }[] }) => (
    <nav>{items.map((item) => item.label).join(' ')}</nav>
  ),
  buttonVariants: () => '',
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: string
    description?: string
    action?: ReactNode
  }) => (
    <section>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  ),
  StatusBadge: ({ label }: { label?: string }) => <span>{label}</span>,
}))
vi.mock('lucide-react', () => ({
  CalendarDays: () => null,
  Check: () => null,
  ChevronDown: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('../../_lib/auth-helper', () => ({
  requireSchoolSession: requireSchoolSessionMock,
  requireTeacher: requireTeacherMock,
}))
vi.mock('./_components/cancel-attendance-form', () => ({
  CancelAttendanceForm: ({ confirmation }: { confirmation?: object }) => (
    <button type="button" data-confirm={confirmation ? 'yes' : 'no'}>
      cancel form
    </button>
  ),
  CancelOccurrenceForm: ({ confirmation }: { confirmation?: object }) => (
    <button type="button" data-confirm={confirmation ? 'yes' : 'no'}>
      cancel occurrence form
    </button>
  ),
}))

const { default: AttendanceTrackingPage, generateMetadata } = await import('./page')

const CLASS_FILTER_ID = '00000000-0000-4000-8000-000000000001'
const TEACHER_FILTER_ID = '00000000-0000-4000-8000-000000000002'

const slot = (id: string, startTime: string, endTime: string) => ({
  id,
  classPeriodId: 'class-1',
  weekday: 4,
  startTime,
  endTime,
  classPeriod: { name: 'CP-A' },
})

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolSessionMock.mockResolvedValue({
    schoolId: 'school-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  })
  getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026–2027' })
  dbMock.config.findFirst.mockResolvedValue({ value: 'true' })
  dbMock.classScheduleSlot.findMany.mockResolvedValue([
    slot('slot-morning', '08:30', '10:00'),
    slot('slot-afternoon', '14:00', '15:30'),
  ])
  dbMock.attendanceSession.findMany.mockResolvedValue([
    {
      id: 'adhoc-1',
      classPeriodId: 'class-1',
      classScheduleSlotId: null,
      occurrenceKey: 'adhoc',
      status: 'VALIDATED',
      classPeriod: { name: 'CP-A' },
    },
  ])
  dbMock.event.findMany.mockResolvedValue([])
  dbMock.classPeriod.findMany.mockResolvedValue([{ id: 'class-1', name: 'CP-A' }])
  dbMock.teacher.findMany.mockResolvedValue([
    { id: 'teacher-1', firstName: 'Nora', lastName: 'Diallo' },
  ])
})

describe('AttendanceTrackingPage', () => {
  it('preserves admin filters and separates cancelled scheduled sessions from expected calls', async () => {
    dbMock.attendanceSession.findMany.mockResolvedValue([
      {
        id: 'cancelled-1',
        classPeriodId: 'class-1',
        classScheduleSlotId: 'slot-morning',
        occurrenceKey: 'slot-morning',
        status: 'CANCELLED',
        classPeriod: { name: 'CP-A' },
      },
    ])
    const { container } = render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({ date: '2026-09-17' }),
      })
    )
    expect(container.querySelector('main')).not.toBeInTheDocument()
    expect(screen.getByLabelText('class')).toHaveTextContent('allClasses')
    expect(screen.getByLabelText('teacher')).toHaveTextContent('allTeachers')
    expect(container.querySelector('input[name="classId"]')).toHaveValue('')
    expect(container.querySelector('input[name="teacherId"]')).toHaveValue('')
    expect(screen.getByText('cancelledCalls').parentElement).toHaveTextContent('1')
    expect(screen.getByText('expectedCalls').parentElement).toHaveTextContent('1')
    expect(screen.getByText('sessionCancelled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cancel occurrence form' })).toHaveAttribute(
      'data-confirm',
      'yes'
    )
    expect(screen.getByRole('button', { name: 'cancel form' })).toHaveAttribute(
      'data-confirm',
      'no'
    )
    expect(screen.getByRole('link', { name: 'start' })).toHaveAttribute(
      'href',
      '/dashboard/my-classes/class-1/attendance?date=2026-09-17&slotId=slot-afternoon'
    )
  })

  it('keeps two scheduled slots distinct, separates an adhoc session, and preserves filters in date navigation', async () => {
    render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({
          date: '2026-09-17',
          classId: CLASS_FILTER_ID,
          teacherId: TEACHER_FILTER_ID,
        }),
      })
    )

    expect(
      screen.getByRole('heading', { name: 'scheduledOccurrences' }).parentElement
    ).toHaveTextContent('2')
    expect(screen.getByRole('heading', { name: 'adhocOccurrences' })).toBeInTheDocument()
    expect(screen.getByText('exceptionalOccurrence · 17 septembre 2026')).toBeInTheDocument()

    const startLinks = screen.getAllByRole('link', { name: 'start' })
    expect(startLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard/my-classes/class-1/attendance?date=2026-09-17&slotId=slot-morning',
      '/dashboard/my-classes/class-1/attendance?date=2026-09-17&slotId=slot-afternoon',
    ])
    expect(screen.getByRole('link', { name: 'previousDay' })).toHaveAttribute(
      'href',
      `/dashboard/attendance?date=2026-09-16&classId=${CLASS_FILTER_ID}&teacherId=${TEACHER_FILTER_ID}`
    )
    expect(screen.getByRole('link', { name: 'nextDay' })).toHaveAttribute(
      'href',
      `/dashboard/attendance?date=2026-09-18&classId=${CLASS_FILTER_ID}&teacherId=${TEACHER_FILTER_ID}`
    )
  })

  it('uses the teacher assignment scope and never sends a teacher to the admin schedule page', async () => {
    requireSchoolSessionMock.mockResolvedValue({
      schoolId: 'school-1',
      role: 'PARENT',
      isSuperAdmin: false,
    })
    requireTeacherMock.mockResolvedValue({ schoolId: 'school-1', teacherId: 'teacher-1' })
    dbMock.classScheduleSlot.findMany.mockResolvedValue([])
    dbMock.attendanceSession.findMany.mockResolvedValue([])

    render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({
          date: '2026-09-17',
          classId: CLASS_FILTER_ID,
          teacherId: TEACHER_FILTER_ID,
        }),
      })
    )

    expect(dbMock.classScheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classPeriod: {
            isActive: true,
            periodId: 'period-1',
            teachers: { some: { teacherId: 'teacher-1' } },
          },
        }),
      })
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'viewSchedule' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'nextDay' })).toHaveAttribute(
      'href',
      '/dashboard/attendance?date=2026-09-18'
    )
  })

  it('keeps an existing scheduled session visible during a retroactive closure without inventing missing slots', async () => {
    dbMock.event.findMany.mockResolvedValue([
      {
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: new Date('2026-09-17T00:00:00.000Z'),
        endAt: new Date('2026-09-17T23:59:59.999Z'),
      },
    ])
    dbMock.attendanceSession.findMany.mockResolvedValue([
      {
        id: 'scheduled-1',
        classPeriodId: 'class-1',
        classScheduleSlotId: 'slot-morning',
        occurrenceKey: 'slot-morning',
        status: 'VALIDATED',
        classPeriod: { name: 'CP-A' },
      },
    ])

    render(
      await AttendanceTrackingPage({
        params: Promise.resolve({ locale: 'fr' }),
        searchParams: Promise.resolve({ date: '2026-09-17' }),
      })
    )

    expect(
      screen.getByRole('heading', { name: 'scheduledOccurrences' }).parentElement
    ).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: 'viewOrCorrect' })).toHaveAttribute(
      'href',
      '/dashboard/my-classes/class-1/attendance?date=2026-09-17&slotId=slot-morning'
    )
    expect(screen.queryByRole('link', { name: 'start' })).not.toBeInTheDocument()
  })
})

describe('AttendanceTrackingPage metadata', () => {
  const metadataFor = () => generateMetadata({ params: Promise.resolve({ locale: 'fr' }) })

  it.each([
    [{ isSuperAdmin: false, role: 'ADMIN' }],
    [{ isSuperAdmin: false, role: 'TEACHER' }],
    [{ isSuperAdmin: true, role: null }],
  ])('titles the page for a role that can open it (%o)', async (context) => {
    getSchoolContextMock.mockResolvedValue({ schoolId: 'school-1', userId: 'u', ...context })
    await expect(metadataFor()).resolves.toEqual({
      title: 'dashboard.pages.attendance.trackingTitle',
    })
  })

  it('does not reveal the page title to a parent or a visitor', async () => {
    getSchoolContextMock.mockResolvedValue({ isSuperAdmin: false, role: 'PARENT' })
    await expect(metadataFor()).resolves.toEqual({ title: 'errorPages.404.title' })
    getSchoolContextMock.mockResolvedValue(null)
    await expect(metadataFor()).resolves.toEqual({ title: 'errorPages.404.title' })
  })
})
