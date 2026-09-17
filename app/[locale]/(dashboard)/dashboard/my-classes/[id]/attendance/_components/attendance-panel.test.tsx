import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  openAttendanceActionMock,
  updateAttendanceEntryActionMock,
  markAllPresentActionMock,
  validateAttendanceActionMock,
  toastSuccessMock,
  routerReplaceMock,
} = vi.hoisted(() => ({
  openAttendanceActionMock: vi.fn(),
  updateAttendanceEntryActionMock: vi.fn(),
  markAllPresentActionMock: vi.fn(),
  validateAttendanceActionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: toastSuccessMock } }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ replace: routerReplaceMock }) }))

vi.mock('@peaklab/ui', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Card: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}))

vi.mock('../../../../../_lib/attendance-actions', () => ({
  openAttendanceAction: openAttendanceActionMock,
  updateAttendanceEntryAction: updateAttendanceEntryActionMock,
  markAllPresentAction: markAllPresentActionMock,
  validateAttendanceAction: validateAttendanceActionMock,
}))

import { AttendancePanel } from './attendance-panel'

describe('AttendancePanel', () => {
  beforeEach(() => vi.clearAllMocks())

  const labels = {
    title: 'Attendance',
    start: 'Start',
    allPresent: 'All present',
    draft: 'Draft',
    validate: 'Validate',
    validated: 'Validated',
    saveCorrections: 'Save corrections',
    validationSuccess: 'Attendance validated',
    correctionsSaved: 'Corrections saved',
    savedTitle: 'Attendance saved',
    returningToTracking: 'Returning to attendance tracking…',
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    unrecorded: 'Not recorded',
  }
  const session = {
    id: 'session-1',
    status: 'DRAFT',
    entries: Array.from({ length: 20 }, (_, index) => ({
      id: `entry-${index}`,
      studentName: `Student ${index}`,
      status: index < 18 ? 'PRESENT' : ('ABSENT' as const),
    })),
  }

  it('renders a touch-sized start control', () => {
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        labels={labels}
      />
    )
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('opens the scheduled occurrence selected from tracking', async () => {
    openAttendanceActionMock.mockResolvedValue(session)
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        occurredOn="2026-09-14"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        labels={labels}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() =>
      expect(openAttendanceActionMock).toHaveBeenCalledWith({
        classPeriodId: '00000000-0000-4000-8000-000000000001',
        classScheduleSlotId: '00000000-0000-4000-8000-000000000002',
        occurredOn: '2026-09-14',
      })
    )
  })

  it('shows draft counters for eighteen present, two absent and zero unrecorded', async () => {
    openAttendanceActionMock.mockResolvedValue(session)
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        labels={labels}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('Draft')).toBeInTheDocument()
    expect(
      screen.getByText('Present: 18 · Late: 0 · Absent: 2 · Not recorded: 0')
    ).toBeInTheDocument()
  })

  it('marks only unrecorded students present and exposes validation', async () => {
    openAttendanceActionMock.mockResolvedValue({
      ...session,
      entries: [{ id: 'entry-1', studentName: 'Amina', status: 'NOT_RECORDED' }],
    })
    markAllPresentActionMock.mockResolvedValue('OK')
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        labels={labels}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const allPresent = await screen.findByRole('button', { name: 'All present' })
    await waitFor(() => expect(allPresent).not.toBeDisabled())
    fireEvent.click(allPresent)
    await waitFor(() =>
      expect(markAllPresentActionMock).toHaveBeenCalledWith({ sessionId: 'session-1' })
    )
    await waitFor(() =>
      expect(
        screen.getByText('Present: 1 · Late: 0 · Absent: 0 · Not recorded: 0')
      ).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument()
  })

  it('confirms validation, animates success and returns to attendance tracking', async () => {
    openAttendanceActionMock.mockResolvedValue(session)
    validateAttendanceActionMock.mockResolvedValue('OK')
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        occurredOn="2026-09-17"
        labels={labels}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const validate = await screen.findByRole('button', { name: 'Validate' })
    await waitFor(() => expect(validate).not.toBeDisabled())
    fireEvent.click(validate)

    expect(await screen.findByText('Attendance saved')).toBeInTheDocument()
    expect(screen.getByText('Attendance validated')).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalledWith('Attendance validated')
    await waitFor(() =>
      expect(routerReplaceMock).toHaveBeenCalledWith('/dashboard/attendance?date=2026-09-17')
    )
  })

  it('opens an existing validated call directly without asking to start it again', () => {
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        occurredOn="2026-09-17"
        initialSession={{
          ...session,
          status: 'VALIDATED',
          entries: [
            { id: 'entry-1', studentName: 'Amina', status: 'LATE' },
            { id: 'entry-2', studentName: 'Yasmine', status: 'PRESENT' },
          ],
        }}
        labels={labels}
      />
    )

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(
      screen.getByText('Present: 1 · Late: 1 · Absent: 0 · Not recorded: 0')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save corrections' })).toBeInTheDocument()
  })

  it('marks a student late and updates the counters', async () => {
    openAttendanceActionMock.mockResolvedValue({
      ...session,
      entries: [{ id: 'entry-1', studentName: 'Amina', status: 'NOT_RECORDED' }],
    })
    updateAttendanceEntryActionMock.mockResolvedValue('OK')
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        labels={labels}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Late' }))

    await waitFor(() =>
      expect(updateAttendanceEntryActionMock).toHaveBeenCalledWith({
        sessionId: 'session-1',
        entryId: 'entry-1',
        status: 'LATE',
      })
    )
    expect(
      screen.getByText('Present: 0 · Late: 1 · Absent: 0 · Not recorded: 0')
    ).toBeInTheDocument()
  })
})
