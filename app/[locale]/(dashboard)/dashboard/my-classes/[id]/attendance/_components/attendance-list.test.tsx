import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}))
vi.mock('@peaklab/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}))
vi.mock('lucide-react', () => ({
  Check: () => <svg />,
  MessageSquare: () => <svg />,
  Search: () => <svg />,
  X: () => <svg />,
}))

import { AttendanceList } from './attendance-list'
import type { AttendanceEntry } from './student-attendance-card'

const labels = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  unrecorded: 'Not recorded',
  lateMinutes: 'Minutes late',
  lateMinutesInvalid: 'Invalid minutes',
  message: 'Message',
  messageHint: 'Hint',
  saving: 'Saving',
  saved: 'Saved',
  retry: 'Retry',
}
const reasons = [
  { id: 'r1', label: 'Maladie', justified: true },
  { id: 'r2', label: 'Sans nouvelles', justified: false },
]
const entry = (patch: Partial<AttendanceEntry> & { id: string; studentName: string }) =>
  ({ status: 'PRESENT', lateMinutes: null, message: null, ...patch }) as AttendanceEntry

function renderList(entries: AttendanceEntry[], overrides = {}) {
  const props = {
    entries,
    labels,
    editing: true,
    pending: new Set<string>(),
    globalPending: false,
    errors: {},
    reasonPicker: { options: reasons, title: 'Reason', missing: 'Choose a reason' },
    reasonRequired: true,
    onStatus: vi.fn(),
    onReason: vi.fn(),
    onLateMinutes: vi.fn(),
    onMessage: vi.fn(),
    onFieldBlur: vi.fn(),
    onRetry: vi.fn(),
    onMarkRemaining: vi.fn(),
    onReview: vi.fn(),
    canFinish: true,
    ...overrides,
  }
  render(<AttendanceList {...props} />)
  return props
}

describe('AttendanceList', () => {
  it('marks a student absent from the row and toggles back to unrecorded', () => {
    const props = renderList([
      entry({ id: 'a', studentName: 'Amina' }),
      entry({ id: 'b', studentName: 'Bilal', status: 'ABSENT' }),
    ])

    fireEvent.click(within(screen.getByRole('group', { name: 'Amina' })).getByLabelText('Absent'))
    expect(props.onStatus).toHaveBeenCalledWith('a', 'ABSENT')

    fireEvent.click(within(screen.getByRole('group', { name: 'Bilal' })).getByLabelText('Absent'))
    expect(props.onStatus).toHaveBeenCalledWith('b', 'NOT_RECORDED')
  })

  it('flags a missing required reason and picks one in the drawer', () => {
    const props = renderList([entry({ id: 'a', studentName: 'Amina', status: 'ABSENT' })])

    expect(screen.getByText('list.reasonMissing')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Amina/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))
    expect(props.onReason).toHaveBeenCalledWith('a', reasons[0])
  })

  it('shows the recorded reason label on the row', () => {
    renderList([
      entry({
        id: 'a',
        studentName: 'Amina',
        status: 'ABSENT',
        absenceReasonId: 'old',
        absenceReasonLabel: 'Archived reason',
      }),
    ])
    expect(screen.getByText('Archived reason')).toBeInTheDocument()
    expect(screen.queryByText('list.reasonMissing')).not.toBeInTheDocument()
  })

  it('filters by status and finds a student by name without accents', () => {
    renderList([
      entry({ id: 'a', studentName: 'Chaïma' }),
      entry({ id: 'b', studentName: 'Bilal', status: 'LATE', lateMinutes: 10 }),
    ])

    fireEvent.click(screen.getByRole('button', { name: /^Late\s*\d/ }))
    expect(screen.queryByText('Chaïma')).not.toBeInTheDocument()
    expect(screen.getByText('Bilal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^all\s*\d/ }))
    fireEvent.click(screen.getByRole('button', { name: 'list.search' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'list.search' }), {
      target: { value: 'chaima' },
    })
    expect(screen.getByText('Chaïma')).toBeInTheDocument()
    expect(screen.queryByText('Bilal')).not.toBeInTheDocument()
  })

  it('offers to mark the rest present, then to finish', () => {
    const props = renderList([
      entry({ id: 'a', studentName: 'Amina', status: 'NOT_RECORDED' }),
      entry({ id: 'b', studentName: 'Bilal' }),
    ])
    fireEvent.click(screen.getByRole('button', { name: /list.markRemaining/ }))
    expect(props.onMarkRemaining).toHaveBeenCalled()
  })

  it('opens the review once every student is recorded', () => {
    const props = renderList([entry({ id: 'a', studentName: 'Amina' })])
    fireEvent.click(screen.getByRole('button', { name: /list.finish/ }))
    expect(props.onReview).toHaveBeenCalled()
  })
})
