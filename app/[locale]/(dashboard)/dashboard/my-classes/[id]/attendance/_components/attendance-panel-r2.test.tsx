import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  startAdhoc: vi.fn(),
  startScheduled: vi.fn(),
  allPresent: vi.fn(),
  validate: vi.fn(),
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
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('../../../../../_lib/attendance-actions', () => ({
  updateAttendanceEntryAction: mocks.update,
  startAdhocAttendanceAction: mocks.startAdhoc,
  startScheduledAttendanceAction: mocks.startScheduled,
  markAllPresentAction: mocks.allPresent,
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
  markRemainingPresent: 'Mark {count} remaining',
  reviewAttendance: 'Review',
  partialWarning: '{count} missing',
  validatePartial: 'Validate anyway',
  returnToEntry: 'Return',
  returnClasses: 'Back to classes',
  correctAttendance: 'Correct',
  validatedStatus: 'Validated',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  unrecorded: 'Not recorded',
  lateMinutes: 'Minutes late',
  message: 'Message',
  messageHint: 'Optional',
  saving: 'Saving',
  saved: 'Saved',
  retry: 'Retry',
  previousStudent: 'Previous student',
  nextStudent: 'Next student',
  studentPosition: 'Student {current} of {total}',
  saveBeforeContinue: 'Save first',
  summary: 'Summary',
  reviewSubtitle: 'Check every student before validating.',
  completeStudents: 'Complete {count} students',
  partialWarningSingle: '{count} missing',
  completeStudent: 'Complete this student',
  all: 'All',
  edit: 'Edit',
  noStudents: 'No students',
  errors: {
    unexpected: 'Unexpected',
    notFound: 'Not found',
    validationError: 'Invalid',
    attendanceDisabled: 'Disabled',
    attendanceClosed: 'Closed',
    sessionCancelled: 'Cancelled',
  },
}
const props = {
  classPeriodId: '00000000-0000-4000-8000-000000000001',
  className: 'CP',
  occurredOn: '2026-01-05',
  locale: 'en',
  slots: [],
  selectedOccurrence: 'adhoc' as const,
  labels,
}
type Entry = {
  id: string
  studentName: string
  status: 'NOT_RECORDED' | 'PRESENT' | 'LATE' | 'ABSENT'
  lateMinutes: number | null
  message: string | null
}
const session = (entries: Entry[]) => ({ id: 'session', status: 'DRAFT', entries })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.allPresent.mockResolvedValue('OK')
  mocks.validate.mockResolvedValue('OK')
})

describe('AttendancePanel R2 regressions', () => {
  it('queues a message edited during a pending status save and navigates with its latest saved payload', async () => {
    const first = deferred<'OK'>()
    const second = deferred<'OK'>()
    mocks.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
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

    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), {
      target: { value: 'Traffic' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Next student' })[0])

    first.resolve('OK')
    await waitFor(() =>
      expect(mocks.update).toHaveBeenLastCalledWith({
        sessionId: 'session',
        entryId: 'a',
        status: 'LATE',
        lateMinutes: null,
        message: 'Traffic',
      })
    )
    second.resolve('OK')

    await screen.findByText('Bilal')
    fireEvent.click(screen.getAllByRole('button', { name: 'Previous student' })[0])
    await screen.findByText('Amina')
    expect(screen.getByRole('textbox', { name: /^Message/ })).toHaveValue('Traffic')
  })

  it('keeps failed message content visible and retries the same payload', async () => {
    mocks.update.mockResolvedValueOnce('notFound').mockResolvedValueOnce('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
          { id: 'a', studentName: 'Amina', status: 'PRESENT', lateMinutes: null, message: null },
        ])}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), {
      target: { value: 'Parent called' },
    })
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: /^Message/ })).toHaveValue('Parent called')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2))
    expect(mocks.update).toHaveBeenLastCalledWith({
      sessionId: 'session',
      entryId: 'a',
      status: 'PRESENT',
      lateMinutes: null,
      message: 'Parent called',
    })
  })

  it('blocks collective and validation actions while a per-student save is pending or failed', async () => {
    const pending = deferred<'OK'>()
    mocks.update.mockReturnValueOnce(pending.promise).mockResolvedValueOnce('notFound')
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
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

    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Mark 1 remaining' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()

    pending.resolve('OK')
    await pending.promise
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark 1 remaining' })).toBeEnabled()
    )
    fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), {
      target: { value: 'Retry me' },
    })
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Mark 1 remaining' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()
    expect(mocks.allPresent).not.toHaveBeenCalled()
    expect(mocks.validate).not.toHaveBeenCalled()
  })

  it('does not let two validation clicks overtake a dirty-entry flush', async () => {
    const update = deferred<'OK'>()
    mocks.update.mockReturnValueOnce(update.promise)
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
          {
            id: 'a',
            studentName: 'Amina',
            status: 'PRESENT',
            lateMinutes: null,
            message: null,
          },
        ])}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), {
      target: { value: 'Confirm first' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(mocks.validate).not.toHaveBeenCalled()
    update.resolve('OK')

    await waitFor(() => expect(mocks.validate).toHaveBeenCalledTimes(1))
  })

  it('marks only the remaining entry present and keeps absent and late entries in the recap', async () => {
    mocks.update.mockResolvedValue('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
          { id: 'a', studentName: 'Amina', status: 'ABSENT', lateMinutes: null, message: 'Ill' },
          { id: 'b', studentName: 'Bilal', status: 'LATE', lateMinutes: 8, message: 'Traffic' },
          {
            id: 'c',
            studentName: 'Chloé',
            status: 'NOT_RECORDED',
            lateMinutes: null,
            message: null,
          },
        ])}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark 1 remaining' }))
    await waitFor(() => expect(mocks.allPresent).toHaveBeenCalledWith({ sessionId: 'session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    const summary = screen.getByLabelText('Summary')
    expect(screen.getByText('Amina').closest('li')).toHaveTextContent(/Absent.*Ill/)
    expect(screen.getByText('Bilal').closest('li')).toHaveTextContent(/Late.*8 min.*Traffic/)
    expect(screen.getByText('Chloé').closest('li')).toHaveTextContent('Present')
    expect(summary).toHaveTextContent(/1\s*Present/)
    expect(summary).toHaveTextContent(/1\s*Late/)
    expect(summary).toHaveTextContent(/1\s*Absent/)
  })

  it('shows every status, message, and the partial-validation warning in the recap', () => {
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
          { id: 'a', studentName: 'Amina', status: 'PRESENT', lateMinutes: null, message: 'Fine' },
          { id: 'b', studentName: 'Bilal', status: 'LATE', lateMinutes: 5, message: 'Bus' },
          { id: 'c', studentName: 'Chloé', status: 'ABSENT', lateMinutes: null, message: 'Sick' },
          {
            id: 'd',
            studentName: 'Dalia',
            status: 'NOT_RECORDED',
            lateMinutes: null,
            message: null,
          },
        ])}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    const summary = screen.getByLabelText('Summary')
    expect(screen.getByText('Amina').closest('li')).toHaveTextContent(/Present.*Fine/)
    expect(screen.getByText('Bilal').closest('li')).toHaveTextContent(/Late.*5 min.*Bus/)
    expect(screen.getByText('Chloé').closest('li')).toHaveTextContent(/Absent.*Sick/)
    expect(screen.getByText('Dalia').closest('li')).toHaveTextContent('Not recorded')
    expect(summary).toHaveTextContent(/1\s*Present/)
    expect(summary).toHaveTextContent(/1\s*Late/)
    expect(summary).toHaveTextContent(/1\s*Absent/)
    expect(summary).toHaveTextContent(/1\s*Not recorded/)
    expect(screen.getByText('1 missing')).toBeInTheDocument()
  })

  it('resets late minutes while preserving its message when set back to not recorded', async () => {
    mocks.update.mockResolvedValue('OK')
    render(
      <AttendancePanel
        {...props}
        initialSession={session([
          { id: 'a', studentName: 'Amina', status: 'LATE', lateMinutes: 12, message: 'Bus' },
        ])}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Not recorded' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        sessionId: 'session',
        entryId: 'a',
        status: 'NOT_RECORDED',
        lateMinutes: null,
        message: 'Bus',
      })
    )
  })
})
