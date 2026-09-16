import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

const {
  openAttendanceActionMock,
  updateAttendanceEntryActionMock,
  markAllPresentActionMock,
  validateAttendanceActionMock,
} = vi.hoisted(() => ({
  openAttendanceActionMock: vi.fn(),
  updateAttendanceEntryActionMock: vi.fn(),
  markAllPresentActionMock: vi.fn(),
  validateAttendanceActionMock: vi.fn(),
}))

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
  const labels = {
    title: 'Attendance',
    start: 'Start',
    allPresent: 'All present',
    draft: 'Draft',
    validate: 'Validate',
    present: 'Present',
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
        labels={labels}
      />
    )
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows draft counters for eighteen present, two absent and zero unrecorded', async () => {
    openAttendanceActionMock.mockResolvedValue(session)
    render(
      <AttendancePanel
        classPeriodId="00000000-0000-4000-8000-000000000001"
        className="CP"
        labels={labels}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('DRAFT')).toBeInTheDocument()
    expect(screen.getByText('Present: 18 · Absent: 2 · Not recorded: 0')).toBeInTheDocument()
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
      expect(screen.getByText('Present: 1 · Absent: 0 · Not recorded: 0')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument()
  })
})
