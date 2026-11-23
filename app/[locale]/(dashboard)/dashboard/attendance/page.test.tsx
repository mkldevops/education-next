import { render, screen } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const frequencyMock = vi.hoisted(() => vi.fn(() => Promise.resolve('PER_SLOT')))
vi.mock('@/use-cases/config/get-attendance-frequency', () => ({
  getAttendanceFrequency: frequencyMock,
}))

const dbMock = {
  config: { findFirst: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
  attendanceSession: { findMany: vi.fn(), groupBy: vi.fn() },
  attendanceEntry: { findMany: vi.fn() },
  classAssignment: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
  classPeriod: { findMany: vi.fn() },
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
  hasSchoolRole: (context: { isSuperAdmin: boolean; roles: string[] }, role: string) =>
    !context.isSuperAdmin && context.roles.includes(role),
  isActiveSchoolAdmin: (context: { isSuperAdmin: boolean; roles: string[] }) =>
    context.isSuperAdmin || context.roles.includes('ADMIN'),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('@peaklab/ui', async () => ({
  ...(await vi.importActual<typeof import('@/components/ui/select')>('@/components/ui/select')),
  ...(await vi.importActual<typeof import('@/components/ui/use-menu')>('@/components/ui/use-menu')),
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
  MoreHorizontal: () => null,
  Plus: () => null,
  Download: () => null,
  FileSpreadsheet: () => null,
  Printer: () => null,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

const CM1 = '00000000-0000-4000-8000-000000000001'
const CM2 = '00000000-0000-4000-8000-000000000002'
const OTHER_CLASS_ID = '00000000-0000-4000-8000-000000000009'

const day = (value: string) => new Date(`${value}T00:00:00.000Z`)

type FindManyArgs = { select?: { entries?: unknown } }

const recordedSessions = [
  {
    id: 's-1',
    occurredOn: day('2026-11-05'),
    occurrenceKey: 'slot-thu',
    classScheduleSlotId: 'slot-thu',
    classScheduleSlot: { startTime: '09:00' },
    status: 'VALIDATED',
    entries: [
      { studentId: 'st-1', studentName: 'Adam Moussa', status: 'PRESENT' },
      { studentId: 'st-2', studentName: 'Yanis Benali', status: 'ABSENT' },
    ],
  },
  {
    id: 's-2',
    occurredOn: day('2026-11-12'),
    occurrenceKey: 'slot-thu',
    classScheduleSlotId: 'slot-thu',
    classScheduleSlot: { startTime: '09:00' },
    status: 'CANCELLED',
    entries: [],
  },
]

function renderPage(searchParams: Record<string, string>) {
  return AttendanceTrackingPage({
    params: Promise.resolve({ locale: 'fr' }),
    searchParams: Promise.resolve(searchParams),
  })
}

function selectedSessionsQuery() {
  return dbMock.attendanceSession.findMany.mock.calls
    .map(([args]) => args)
    .find((args: FindManyArgs) => args.select?.entries)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-19T15:00:00.000Z'))
  frequencyMock.mockResolvedValue('PER_SLOT')
  requireSchoolSessionMock.mockResolvedValue({
    schoolId: 'school-1',
    roles: ['ADMIN'],
    isSuperAdmin: false,
  })
  getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026–2027' })
  dbMock.config.findFirst.mockResolvedValue({ value: 'true' })
  dbMock.classPeriod.findMany.mockResolvedValue([
    { id: CM2, name: 'CM2' },
    { id: CM1, name: 'CM1' },
  ])
  dbMock.classScheduleSlot.findMany.mockResolvedValue([
    { id: 'slot-tue', classPeriodId: CM1, weekday: 2, startTime: '14:00' },
    { id: 'slot-thu', classPeriodId: CM1, weekday: 4, startTime: '09:00' },
  ])
  dbMock.attendanceSession.findMany.mockImplementation(async (args: FindManyArgs) =>
    args.select?.entries
      ? recordedSessions
      : recordedSessions.map((session) => ({ ...session, classPeriodId: CM1 }))
  )
  dbMock.attendanceSession.groupBy.mockResolvedValue([
    { classPeriodId: CM1, _min: { occurredOn: day('2026-11-05') } },
  ])
  dbMock.event.findMany.mockResolvedValue([])
  dbMock.classAssignment.findMany.mockResolvedValue([
    { enrollment: { studentId: 'st-1' } },
    { enrollment: { studentId: 'st-2' } },
  ])
  dbMock.attendanceEntry.findMany.mockResolvedValue([
    { studentId: 'st-1', attendanceSession: { occurredOn: day('2026-11-05') } },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AttendanceTrackingPage', () => {
  it('shows only the recorded calls by default and lists the pending ones above the grid', async () => {
    render(await renderPage({ range: 'custom', from: '2026-11-01', to: '2026-11-19' }))

    expect(screen.getByRole('link', { name: 'openCall' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'catchUpCall' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('cancelledColumn')).not.toBeInTheDocument()
    expect(screen.queryAllByTitle('missedCell')).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: /catchUp|takeCall/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'cancel form' })).toHaveLength(1)
    expect(screen.getByRole('switch', { name: 'showGaps' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('opens the class with late calls first and shows missed and today calls as columns', async () => {
    render(await renderPage({ range: 'custom', from: '2026-11-01', to: '2026-11-19', all: '1' }))

    const chips = screen
      .getAllByRole('link', { current: undefined })
      .filter((link) => /CM[12]/.test(link.textContent ?? ''))
    expect(chips.map((chip) => chip.textContent?.slice(0, 3))).toEqual(['CM1', 'CM2'])
    expect(screen.getByRole('link', { name: /CM1/ })).toHaveAttribute('aria-current', 'page')

    expect(selectedSessionsQuery()).toEqual(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          classPeriodId: CM1,
          occurredOn: { gte: day('2026-11-01'), lte: day('2026-11-19') },
        },
      })
    )
    expect(dbMock.attendanceSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          classPeriodId: { in: [CM2, CM1] },
          status: { not: 'CANCELLED' },
        },
      })
    )

    const missed = screen.getAllByRole('link', { name: 'catchUpCall' })
    expect(missed.map((link) => link.getAttribute('href'))).toEqual([
      `/dashboard/my-classes/${CM1}/attendance?date=2026-11-10&slotId=slot-tue`,
      `/dashboard/my-classes/${CM1}/attendance?date=2026-11-17&slotId=slot-tue`,
    ])
    expect(screen.getByRole('link', { name: 'takeCallOn' })).toHaveAttribute(
      'href',
      `/dashboard/my-classes/${CM1}/attendance?date=2026-11-19&slotId=slot-thu`
    )
    expect(screen.getByRole('link', { name: 'openCall' })).toHaveAttribute(
      'href',
      `/dashboard/my-classes/${CM1}/attendance?date=2026-11-05&slotId=slot-thu`
    )
    expect(screen.getByTitle('cancelledColumn')).toBeInTheDocument()
    expect(screen.getAllByTitle('missedCell')).toHaveLength(4)

    const names = screen.getAllByRole('rowheader').map((cell) => cell.textContent)
    expect(names).toEqual(['Yanis Benali', 'Adam Moussa'])
    expect(screen.getAllByText('never').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /export/ })).toBeInTheDocument()
  })

  it('does not flag a student who left the class as without presence', async () => {
    dbMock.classAssignment.findMany.mockResolvedValue([{ enrollment: { studentId: 'st-1' } }])
    render(await renderPage({ range: 'custom', from: '2026-11-01', to: '2026-11-19' }))

    expect(dbMock.classAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: 'school-1',
          classPeriodId: CM1,
          enrollment: expect.objectContaining({
            schoolId: 'school-1',
            student: { OR: [{ isActive: true }, { leftAt: { gte: day('2026-11-01') } }] },
          }),
        }),
      })
    )
    // Yanis (st-2) never came but left: his "never" is no longer flagged in red.
    for (const cell of screen.getAllByText('never')) {
      expect(cell.className).not.toContain('text-danger')
    }
  })

  it('lets an admin cancel a recorded or planned call and restore a cancelled one', async () => {
    render(await renderPage({ range: 'custom', from: '2026-11-01', to: '2026-11-19', all: '1' }))

    expect(screen.getAllByRole('button', { name: 'cancel form' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'cancel occurrence form' })).toHaveLength(3)
  })

  it('keeps the class requested in the URL when it is in scope', async () => {
    render(await renderPage({ classId: CM2 }))

    expect(screen.getByRole('link', { name: /CM2/ })).toHaveAttribute('aria-current', 'page')
    expect(selectedSessionsQuery()).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ classPeriodId: CM2 }) })
    )
  })

  it('opens the two weeks ending on the date of a former day link', async () => {
    render(await renderPage({ date: '2026-11-19' }))

    expect(selectedSessionsQuery()).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          occurredOn: { gte: day('2026-11-05'), lte: day('2026-11-19') },
        }),
      })
    )
  })

  it('limits a teacher to their classes, ignores a class outside that scope and hides cancellation', async () => {
    requireSchoolSessionMock.mockResolvedValue({
      schoolId: 'school-1',
      roles: ['TEACHER'],
      isSuperAdmin: false,
    })
    requireTeacherMock.mockResolvedValue({ schoolId: 'school-1', teacherId: 'teacher-1' })
    dbMock.classPeriod.findMany.mockResolvedValue([{ id: CM1, name: 'CM1' }])

    render(await renderPage({ classId: OTHER_CLASS_ID }))

    expect(dbMock.classPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          isActive: true,
          periodId: 'period-1',
          teachers: { some: { teacherId: 'teacher-1' } },
        },
      })
    )
    expect(selectedSessionsQuery()).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ classPeriodId: CM1 }) })
    )
    expect(screen.queryByRole('button', { name: /cancel/ })).not.toBeInTheDocument()
  })

  it('shows an empty state when no class is available', async () => {
    dbMock.classPeriod.findMany.mockResolvedValue([])
    render(await renderPage({}))

    expect(screen.getByRole('heading', { name: 'noClasses' })).toBeInTheDocument()
    expect(dbMock.attendanceSession.findMany).not.toHaveBeenCalled()
  })

  it('returns not found when attendance is disabled', async () => {
    dbMock.config.findFirst.mockResolvedValue({ value: 'false' })
    await expect(renderPage({})).rejects.toThrow('notFound')
  })
})

describe('AttendanceTrackingPage metadata', () => {
  const metadataFor = () => generateMetadata({ params: Promise.resolve({ locale: 'fr' }) })

  it.each([
    [{ isSuperAdmin: false, roles: ['ADMIN'] }],
    [{ isSuperAdmin: false, roles: ['TEACHER'] }],
    [{ isSuperAdmin: true, roles: [] }],
  ])('titles the page for a role that can open it (%o)', async (context) => {
    getSchoolContextMock.mockResolvedValue({ schoolId: 'school-1', userId: 'u', ...context })
    await expect(metadataFor()).resolves.toEqual({
      title: 'dashboard.pages.attendance.trackingTitle',
    })
  })

  it('does not reveal the page title to a parent or a visitor', async () => {
    getSchoolContextMock.mockResolvedValue({ isSuperAdmin: false, roles: ['PARENT'] })
    await expect(metadataFor()).resolves.toEqual({ title: 'errorPages.404.title' })
    getSchoolContextMock.mockResolvedValue(null)
    await expect(metadataFor()).resolves.toEqual({ title: 'errorPages.404.title' })
  })
})
