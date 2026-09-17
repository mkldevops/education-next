import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@peaklab/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}))
vi.mock('lucide-react', () => ({ MessageSquare: () => <svg /> }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AttendanceReview } from './attendance-review'

const labels = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  unrecorded: 'Not recorded',
  summary: 'Summary',
  reviewAttendance: 'Review',
  reviewSubtitle: 'Check details',
  partialWarning: '{count} missing',
  partialWarningSingle: '1 missing',
  completeStudents: 'Complete {count}',
  completeStudent: 'Complete one',
  all: 'All',
  edit: 'Edit',
  returnToEntry: 'Return',
  validate: 'Validate',
  validatePartial: 'Validate anyway',
  validatedStatus: 'Validated',
  correctAttendance: 'Correct',
  returnClasses: 'Classes',
}
const entries = [
  {
    id: 'a',
    studentName: 'Amina Long Name',
    status: 'LATE' as const,
    lateMinutes: 0,
    message: 'Note',
  },
  {
    id: 'b',
    studentName: 'Bilal',
    status: 'NOT_RECORDED' as const,
    lateMinutes: null,
    message: null,
  },
]

describe('AttendanceReview', () => {
  it('filters rows without changing totals or the partial warning', () => {
    render(
      <AttendanceReview
        entries={entries}
        labels={labels}
        onReturn={vi.fn()}
        onComplete={vi.fn()}
        onEdit={vi.fn()}
        onValidate={vi.fn()}
        validating={false}
        validated={false}
        onCorrect={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Late/ }))
    expect(screen.getByText('Amina Long Name')).toBeInTheDocument()
    expect(screen.queryByText('Bilal')).not.toBeInTheDocument()
    expect(screen.getByText('1 missing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1Late/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('0 min')).toBeInTheDocument()
  })
  it('returns the selected row id for correction', () => {
    const onEdit = vi.fn()
    render(
      <AttendanceReview
        entries={entries}
        labels={labels}
        onReturn={vi.fn()}
        onComplete={vi.fn()}
        onEdit={onEdit}
        onValidate={vi.fn()}
        validating={false}
        validated={false}
        onCorrect={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bilal' }))
    expect(onEdit).toHaveBeenCalledWith('b')
  })
  it('renders a validated recap as a read-only completion state', () => {
    render(
      <AttendanceReview
        entries={entries}
        labels={labels}
        onReturn={vi.fn()}
        onComplete={vi.fn()}
        onEdit={vi.fn()}
        onValidate={vi.fn()}
        validating={false}
        validated
        onCorrect={vi.fn()}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Validated')
    expect(screen.queryByRole('button', { name: 'Validate anyway' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Correct' })).toBeInTheDocument()
  })
})
