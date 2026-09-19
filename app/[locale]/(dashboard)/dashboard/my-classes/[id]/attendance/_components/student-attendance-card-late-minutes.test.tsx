import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@peaklab/ui', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

import { type AttendanceEntry, StudentAttendanceCard } from './student-attendance-card'

const labels = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  unrecorded: 'Not recorded',
  lateMinutes: 'Minutes late',
  lateMinutesInvalid: 'Invalid delay',
  message: 'Message',
  messageHint: 'Hint',
  saving: 'Saving',
  saved: 'Saved',
  retry: 'Retry',
}

function Harness({ onLateMinutes }: { onLateMinutes: (value: number | null) => void }) {
  const [entry, setEntry] = useState<AttendanceEntry>({
    id: 'e1',
    studentName: 'Ada Lovelace',
    status: 'LATE',
    lateMinutes: 5,
    message: null,
  })
  return (
    <StudentAttendanceCard
      entry={entry}
      labels={labels}
      editing
      pending={false}
      globalPending={false}
      saved={false}
      onStatus={() => {}}
      onLateMinutes={(value) => {
        onLateMinutes(value)
        setEntry((current) => ({ ...current, lateMinutes: value }))
      }}
      onMessage={() => {}}
      onFieldBlur={() => {}}
      onRetry={() => {}}
    />
  )
}

describe('StudentAttendanceCard late minutes', () => {
  it('keeps an invalid entry visible, then clamps it on blur and clears the alert', () => {
    const onLateMinutes = vi.fn()
    render(<Harness onLateMinutes={onLateMinutes} />)
    const input = screen.getByRole('spinbutton', { name: 'Minutes late' }) as HTMLInputElement

    fireEvent.change(input, { target: { value: '-3' } })
    expect(input.value).toBe('-3')
    expect(screen.getByRole('alert').textContent).toBe('Invalid delay')
    expect(onLateMinutes).not.toHaveBeenCalled()

    fireEvent.blur(input)
    expect(input.value).toBe('0')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onLateMinutes).toHaveBeenCalledWith(0)
  })
})
