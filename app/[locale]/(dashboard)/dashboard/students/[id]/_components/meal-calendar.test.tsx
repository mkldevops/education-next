import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toggleMock = vi.fn()
const toastMock = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/lib/toast', () => ({ toastActionError: toastMock }))
vi.mock('../../../../_lib/meal-actions', () => ({ toggleMealAbsenceAction: toggleMock }))

const { MealCalendar } = await import('./meal-calendar')

const days = [
  { day: '2026-09-28', status: 'paid' as const },
  { day: '2026-10-05', status: 'paid' as const },
  { day: '2026-10-08', status: 'absent' as const },
  { day: '2026-10-12', status: 'closed' as const },
  { day: '2026-10-26', status: 'unpaid' as const },
]

const show = () =>
  render(
    <MealCalendar
      studentId="student-1"
      service="CANTEEN"
      days={days}
      today="2026-10-24"
      locale="fr"
    />
  )

beforeEach(() => {
  vi.clearAllMocks()
  toggleMock.mockResolvedValue('OK')
})

describe('MealCalendar', () => {
  it("opens on today's month with each scheduled day's status", () => {
    show()

    expect(screen.getByRole('button', { name: '2026-10-05 · status.paid' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '2026-10-12 · status.closed' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /2026-09-28/ })).toBeNull()
  })

  it('marks a served day absent, and clears an absent one', async () => {
    show()

    fireEvent.click(screen.getByRole('button', { name: '2026-10-26 · status.unpaid' }))
    await waitFor(() =>
      expect(toggleMock).toHaveBeenCalledWith({
        studentId: 'student-1',
        service: 'CANTEEN',
        day: '2026-10-26',
        absent: true,
      })
    )

    fireEvent.click(screen.getByRole('button', { name: '2026-10-08 · status.absent' }))
    await waitFor(() =>
      expect(toggleMock).toHaveBeenLastCalledWith(expect.objectContaining({ absent: false }))
    )
  })

  it('reports a refusal', async () => {
    toggleMock.mockResolvedValue('notServed')
    show()

    fireEvent.click(screen.getByRole('button', { name: '2026-10-26 · status.unpaid' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.any(Function), 'notServed'))
  })

  it('navigates to the previous month, not before the first scheduled one', () => {
    show()

    fireEvent.click(screen.getByRole('button', { name: 'previous' }))

    expect(screen.getByRole('button', { name: '2026-09-28 · status.paid' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled()
  })
})
