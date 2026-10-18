import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: pushMock }) }))

const { AttendanceFilters } = await import('./attendance-filters')

const CLASS_ID = '00000000-0000-4000-8000-000000000001'
const TEACHER_ID = '00000000-0000-4000-8000-000000000002'

function renderFilters(overrides: { classId?: string | null; teacherId?: string | null } = {}) {
  return render(
    <AttendanceFilters
      date="2026-09-17"
      classId={overrides.classId ?? null}
      teacherId={overrides.teacherId ?? null}
      classItems={[
        { value: null, label: 'Toutes les classes' },
        { value: CLASS_ID, label: 'CP-A' },
      ]}
      teacherItems={[
        { value: null, label: 'Tous les enseignants' },
        { value: TEACHER_ID, label: 'Nora Diallo' },
      ]}
      labels={{ date: 'Date', class: 'Classe', teacher: 'Enseignant' }}
    />
  )
}

async function pick(combobox: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: combobox }))
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item)
  fireEvent.click(item)
}

beforeEach(() => {
  pushMock.mockClear()
})

describe('AttendanceFilters', () => {
  it('has no apply button: filters take effect on change', () => {
    renderFilters()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('navigates as soon as the date changes, keeping the other filters', () => {
    renderFilters({ classId: CLASS_ID })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-18' } })
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/attendance?date=2026-09-18&classId=${CLASS_ID}`
    )
  })

  it('ignores an incomplete date', () => {
    renderFilters()
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('navigates as soon as a class is picked', async () => {
    renderFilters({ teacherId: TEACHER_ID })
    await pick('Classe', 'CP-A')
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/attendance?date=2026-09-17&classId=${CLASS_ID}&teacherId=${TEACHER_ID}`
    )
  })

  it('navigates as soon as a teacher is picked', async () => {
    renderFilters()
    await pick('Enseignant', 'Nora Diallo')
    expect(pushMock).toHaveBeenLastCalledWith(
      `/dashboard/attendance?date=2026-09-17&teacherId=${TEACHER_ID}`
    )
  })

  it('drops a filter when its "all" option is picked', async () => {
    renderFilters({ classId: CLASS_ID })
    await pick('Classe', 'Toutes les classes')
    expect(pushMock).toHaveBeenCalledWith('/dashboard/attendance?date=2026-09-17')
  })
})
