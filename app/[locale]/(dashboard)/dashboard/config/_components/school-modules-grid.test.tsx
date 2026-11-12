import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    `${namespace.replace('dashboard.pages.config', 'config')}.${key}${
      values && 'count' in values ? `:${values.count}` : ''
    }`,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  toastActionError: vi.fn(),
}))
vi.mock('../../../_lib/config-actions', () => ({ setConfigAction: vi.fn() }))
vi.mock('../../../_lib/absence-reason-actions', () => ({
  archiveAbsenceReasonAction: vi.fn(),
  createAbsenceReasonAction: vi.fn(),
  reorderAbsenceReasonsAction: vi.fn(),
  updateAbsenceReasonAction: vi.fn(),
}))

import { setConfigAction } from '../../../_lib/config-actions'
import { SchoolModulesGrid } from './school-modules-grid'
import type { SchoolSetting } from './school-setting'

const settings: SchoolSetting[] = [
  { name: 'attendance_enabled', value: 'true', valueType: 'BOOLEAN' },
  { name: 'attendance_frequency', value: 'DAILY', valueType: 'TEXT' },
  { name: 'attendance_entry_mode', value: 'LIST', valueType: 'TEXT' },
  { name: 'attendance_absence_reason_required', value: 'false', valueType: 'BOOLEAN' },
  { name: 'class_schedule_enabled', value: 'false', valueType: 'BOOLEAN' },
  { name: 'class_schedule_visibility', value: 'INTERNAL', valueType: 'TEXT' },
  { name: 'automatic_promotion', value: 'true', valueType: 'BOOLEAN' },
  { name: 'teacher_expenses_enabled', value: 'true', valueType: 'BOOLEAN' },
]
const reasons = [
  { id: 'r1', label: 'Maladie', justified: true },
  { id: 'r2', label: 'Famille', justified: true },
  { id: 'r3', label: 'Rendez-vous médical', justified: true },
  { id: 'r4', label: 'Retard transport', justified: false },
]

const Grid = (props: Partial<Parameters<typeof SchoolModulesGrid>[0]> = {}) => (
  <SchoolModulesGrid
    settings={settings}
    absenceReasons={reasons}
    teacherExpenseCount={0}
    payments={null}
    {...props}
  />
)

describe('SchoolModulesGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows one card per module, without the unused automatic promotion', () => {
    render(<Grid />)

    expect(screen.getByLabelText('config.settings.attendance_enabled.label')).toBeChecked()
    expect(screen.getByLabelText('config.settings.class_schedule_enabled.label')).not.toBeChecked()
    expect(screen.getByLabelText('config.settings.meals_enabled.label')).toBeInTheDocument()
    expect(screen.queryByText('config.settings.automatic_promotion.label')).not.toBeInTheDocument()
  })

  it('offers Configure only on an active module with options', () => {
    render(<Grid />)

    expect(screen.getAllByRole('button', { name: 'config.modules.configure' })).toHaveLength(1)
    expect(screen.getByText(/settings\.attendance_frequency\.daily/)).toBeInTheDocument()
  })

  it('nests the attendance options under its switch in the dialog', () => {
    render(<Grid />)

    fireEvent.click(screen.getByRole('button', { name: 'config.modules.configure' }))
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByLabelText('config.settings.attendance_enabled.label')).toBeChecked()
    expect(dialog.getByText('config.settings.attendance_frequency.label')).toBeInTheDocument()
    expect(dialog.getByText('config.settings.attendance_entry_mode.label')).toBeInTheDocument()
    expect(
      dialog.getByLabelText('config.settings.attendance_absence_reason_required.label')
    ).not.toBeChecked()
    expect(dialog.getByText('Maladie, Famille, Rendez-vous médical…')).toBeInTheDocument()
  })

  it('unfolds the absence reasons in place from Manage', () => {
    render(<Grid />)

    fireEvent.click(screen.getByRole('button', { name: 'config.modules.configure' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'config.absenceReasons.manage:4' }))

    expect(dialog.getByDisplayValue('Retard transport')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'config.absenceReasons.hide' })).toBeInTheDocument()
  })

  it('asks before cutting teacher expenses that already exist', async () => {
    render(<Grid teacherExpenseCount={2} />)

    fireEvent.click(screen.getByLabelText('config.settings.teacher_expenses_enabled.label'))

    expect(
      await screen.findByText('config.settings.teacher_expenses_enabled.confirmDisable.title')
    ).toBeInTheDocument()
    expect(setConfigAction).not.toHaveBeenCalled()
  })

  it('saves a module switch straight away when nothing would be hidden', async () => {
    vi.mocked(setConfigAction).mockResolvedValue({} as never)
    render(<Grid />)

    fireEvent.click(screen.getByLabelText('config.settings.meals_enabled.label'))

    await waitFor(() =>
      expect(setConfigAction).toHaveBeenCalledWith({ name: 'meals_enabled', value: 'true' })
    )
  })
})
