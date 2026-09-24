import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  startAdhoc: vi.fn(),
  startScheduled: vi.fn(),
  allPresent: vi.fn(),
  validate: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('@peaklab/ui', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Card: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  StatusBadge: ({ label }: { label?: string }) => <span>{label}</span>,
}))
vi.mock('lucide-react', () => ({
  Check: () => <svg />,
  ChevronLeft: () => <svg />,
  ChevronRight: () => <svg />,
  MessageSquare: () => <svg />,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    key === 'markRemainingPresent'
      ? `Mark ${values?.count} remaining`
      : key === 'rosterRefreshed'
        ? `Added ${values?.count}`
        : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('../../../../../_lib/attendance-actions', () => ({
  updateAttendanceEntryAction: mocks.update,
  startAdhocAttendanceAction: mocks.startAdhoc,
  startScheduledAttendanceAction: mocks.startScheduled,
  markAllPresentAction: mocks.allPresent,
  refreshAttendanceRosterAction: mocks.refresh,
  validateAttendanceAction: mocks.validate,
}))

import { AttendancePanel } from './attendance-panel'

const labels = {
  title: 'Attendance',
  start: 'Start',
  draft: 'Draft',
  validate: 'Validate',
  date: 'Date',
  schedule: 'Slot',
  selectOccurrence: 'Choose',
  exceptional: 'Exceptional',
  startExceptional: 'Start exceptional',
  changeDate: 'Change date',
  progress: '{recorded} / {total} recorded',
  reviewAttendance: 'Review',
  partialWarning: '{count} missing',
  partialWarningSingle: '1 missing',
  completeStudents: 'Complete {count}',
  completeStudent: 'Complete one',
  all: 'All',
  edit: 'Edit',
  validatePartial: 'Validate anyway',
  returnToEntry: 'Return',
  correctAttendance: 'Correct',
  returnClasses: 'Return to classes',
  validatedStatus: 'Validated',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  unrecorded: 'Not recorded',
  lateMinutes: 'Minutes late',
  lateMinutesInvalid: 'Late minutes must be a whole number between 0 and 1440.',
  message: 'Message',
  messageHint: 'Optional',
  saving: 'Saving',
  saved: 'Saved',
  retry: 'Retry',
  previousStudent: 'Previous student',
  nextStudent: 'Next student',
  previous: 'Previous',
  next: 'Next',
  reviewSubtitle: 'Check details',
  studentPosition: 'Student {current} of {total}',
  saveBeforeContinue: 'Save first',
  summary: 'Summary',
  noStudents: 'No students',
  errors: {
    unexpected: 'Unexpected',
    notFound: 'Not found',
    validationError: 'Invalid',
    attendanceDisabled: 'Disabled',
    attendanceClosed: 'Closed',
    sessionCancelled: 'Cancelled',
    invalidTransition: 'Changed meanwhile',
  },
}
const props = {
  classPeriodId: '00000000-0000-4000-8000-000000000001',
  className: 'CP',
  occurredOn: '2026-01-05',
  locale: 'en',
  slots: [],
  selectedOccurrence: 'adhoc' as const,
  returnHref: '/dashboard/my-classes',
  labels,
}
const makeSession = (
  entries: Array<{
    id: string
    studentName: string
    status: 'NOT_RECORDED' | 'PRESENT' | 'LATE' | 'ABSENT'
    lateMinutes: number | null
    message: string | null
  }> = [
    {
      id: 'a',
      studentName: 'Amina',
      status: 'NOT_RECORDED' as const,
      lateMinutes: null,
      message: null,
    },
  ]
) => ({ id: 's', status: 'DRAFT', entries })

describe('AttendancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('saves the first selected status with the complete entry payload', async () => {
    mocks.update.mockResolvedValue('OK')
    render(<AttendancePanel {...props} initialSession={makeSession()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        sessionId: 's',
        entryId: 'a',
        status: 'PRESENT',
        lateMinutes: null,
        message: null,
      })
    )
  })
  it('keeps the current student on a failed save before next navigation', async () => {
    mocks.update.mockResolvedValue('notFound')
    render(
      <AttendancePanel
        {...props}
        initialSession={makeSession([
          {
            id: 'a',
            studentName: 'Amina',
            status: 'NOT_RECORDED',
            lateMinutes: null,
            message: null,
          },
          {
            id: 'b',
            studentName: 'Bilal',
            status: 'NOT_RECORDED',
            lateMinutes: null,
            message: null,
          },
        ])}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getAllByRole('button', { name: 'Next student' })[0])
    expect(screen.getByText('Amina')).toBeInTheDocument()
  })
  it('clears late minutes but preserves the message after changing to present', async () => {
    mocks.update.mockResolvedValue('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={makeSession([
          { id: 'a', studentName: 'Amina', status: 'LATE', lateMinutes: 12, message: 'Bus' },
        ])}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenLastCalledWith({
        sessionId: 's',
        entryId: 'a',
        status: 'PRESENT',
        lateMinutes: null,
        message: 'Bus',
      })
    )
  })
  it('rejects negative late minutes with a field message instead of sending them', async () => {
    mocks.update.mockResolvedValue('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={makeSession([
          { id: 'a', studentName: 'Amina', status: 'LATE', lateMinutes: 5, message: null },
        ])}
      />
    )
    const input = screen.getByRole('spinbutton', { name: 'Minutes late' })
    fireEvent.change(input, { target: { value: '-3' } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Late minutes must be a whole number between 0 and 1440.'
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(input)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ lateMinutes: -3 }))

    fireEvent.change(input, { target: { value: '7' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.blur(input)
    await waitFor(() =>
      expect(mocks.update).toHaveBeenLastCalledWith({
        sessionId: 's',
        entryId: 'a',
        status: 'LATE',
        lateMinutes: 7,
        message: null,
      })
    )
  })
  it('names the real remaining count and hides the shortcut once everyone is recorded', () => {
    const { rerender } = render(<AttendancePanel {...props} initialSession={makeSession()} />)
    expect(screen.getByRole('button', { name: 'Mark 1 remaining' })).toBeInTheDocument()
    rerender(
      <AttendancePanel
        {...props}
        key="recorded"
        initialSession={makeSession([
          { id: 'a', studentName: 'Amina', status: 'PRESENT', lateMinutes: null, message: null },
        ])}
      />
    )
    expect(screen.queryByRole('button', { name: /remaining/ })).not.toBeInTheDocument()
  })
  it('shows the zero-roster state', () => {
    render(<AttendancePanel {...props} initialSession={makeSession([])} />)
    expect(screen.getByText('No students')).toBeInTheDocument()
  })
  it('keeps the successful validation on the completion recap without a repeat validation action', async () => {
    mocks.validate.mockResolvedValue('OK')
    render(<AttendancePanel {...props} initialSession={makeSession()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate anyway' }))

    await waitFor(() =>
      expect(mocks.validate).toHaveBeenCalledWith({
        sessionId: 's',
      })
    )
    expect(screen.getByRole('status')).toHaveTextContent('Validated')
    expect(screen.queryByRole('button', { name: 'Validate anyway' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Amina' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Correct' })).toBeInTheDocument()
  })
  it('keeps the recap open with an error when validation fails', async () => {
    mocks.validate.mockResolvedValue('notFound')
    render(<AttendancePanel {...props} initialSession={makeSession()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate anyway' }))

    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Validate anyway' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('opens an already validated session directly on the read-only completion recap', () => {
    render(
      <AttendancePanel
        {...props}
        initialSession={{
          ...makeSession([
            { id: 'a', studentName: 'Amina', status: 'PRESENT', lateMinutes: null, message: null },
          ]),
          status: 'VALIDATED',
        }}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Validated')
    expect(screen.getByRole('link', { name: 'Return to classes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Amina' })).not.toBeInTheDocument()
  })
  it('allows correction from a validated recap and a subsequent validation', async () => {
    mocks.validate.mockResolvedValue('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={{
          ...makeSession([
            { id: 'a', studentName: 'Amina', status: 'PRESENT', lateMinutes: null, message: null },
          ]),
          status: 'VALIDATED',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))

    await waitFor(() => expect(mocks.validate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('Validated')
  })

  it('adds the students assigned since the opening while keeping the current student', async () => {
    const amina = {
      id: 'a',
      studentName: 'Amina',
      status: 'PRESENT' as const,
      lateMinutes: null,
      message: null,
    }
    const adam = {
      id: 'b',
      studentName: 'Adam',
      status: 'NOT_RECORDED' as const,
      lateMinutes: null,
      message: null,
    }
    mocks.refresh.mockResolvedValue(makeSession([adam, amina]))
    render(<AttendancePanel {...props} initialSession={makeSession([amina])} />)
    expect(screen.getByText('Student 1 of 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'refreshRoster' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added 1'))
    expect(mocks.refresh).toHaveBeenCalledWith({ sessionId: 's' })
    expect(screen.getByText('Student 2 of 2')).toBeInTheDocument()
  })

  it('reports a refresh refused because the session changed meanwhile', async () => {
    mocks.refresh.mockResolvedValue('invalidTransition')
    render(<AttendancePanel {...props} initialSession={makeSession()} />)
    fireEvent.click(screen.getByRole('button', { name: 'refreshRoster' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Changed meanwhile'))
  })

  it('does not offer a roster refresh on a validated session', () => {
    render(
      <AttendancePanel {...props} initialSession={{ ...makeSession(), status: 'VALIDATED' }} />
    )
    expect(screen.queryByRole('button', { name: 'refreshRoster' })).not.toBeInTheDocument()
  })
})
