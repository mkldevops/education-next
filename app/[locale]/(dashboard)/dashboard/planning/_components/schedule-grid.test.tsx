import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('./schedule-slot-dialog', () => ({
  ScheduleSlotDialog: () => <button type="button">Edit</button>,
}))
vi.mock('./delete-schedule-slot-dialog', () => ({
  DeleteScheduleSlotDialog: () => <button type="button">Delete</button>,
}))

import { ScheduleGrid } from './schedule-grid'

const slot = {
  id: 'slot-thursday',
  classPeriodId: 'class-cp',
  weekday: 4,
  startTime: '13:30',
  endTime: '15:00',
  description: null,
  classPeriod: { id: 'class-cp', name: 'CP-B' },
  teachers: [],
}

describe('ScheduleGrid attendance entry point', () => {
  it('opens the selected slot on its occurrence date in the current week', () => {
    render(
      <ScheduleGrid
        slots={[slot]}
        weekdayLabels={{ 4: 'Thursday' }}
        noTeachersLabel="No teacher"
        contentLabel="Content"
        durationUnits={{ hours: 'h', minutes: 'min' }}
        classes={[]}
        teachersByClass={{}}
        isAdmin
        attendance={{ datesByWeekday: { 4: '2026-09-17' }, label: 'Take attendance' }}
      />
    )

    expect(screen.getByRole('link', { name: 'Take attendance' })).toHaveAttribute(
      'href',
      '/dashboard/my-classes/class-cp/attendance?date=2026-09-17&slotId=slot-thursday'
    )
  })

  it('does not expose attendance when the module is unavailable', () => {
    render(
      <ScheduleGrid
        slots={[slot]}
        weekdayLabels={{ 4: 'Thursday' }}
        noTeachersLabel="No teacher"
        contentLabel="Content"
        durationUnits={{ hours: 'h', minutes: 'min' }}
        classes={[]}
        teachersByClass={{}}
        isAdmin
      />
    )

    expect(screen.queryByRole('link', { name: 'Take attendance' })).not.toBeInTheDocument()
  })
})
