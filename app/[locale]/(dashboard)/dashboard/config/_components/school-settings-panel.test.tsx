import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../../_lib/config-actions', () => ({
  setConfigAction: vi.fn(),
  setThemeColorsAction: vi.fn(),
}))

import { setConfigAction } from '../../../_lib/config-actions'
import { type SchoolSetting, SchoolSettingsPanel } from './school-settings-panel'

const settings: SchoolSetting[] = [
  { name: 'logo_url', value: '', valueType: 'TEXT' },
  { name: 'theme_primary', value: '#3c6e71', valueType: 'COLOR' },
  { name: 'theme_background', value: '', valueType: 'COLOR' },
  { name: 'max_students_per_class', value: '30', valueType: 'NUMBER' },
  { name: 'payments_enabled', value: 'true', valueType: 'BOOLEAN' },
  { name: 'teacher_expenses_enabled', value: 'false', valueType: 'BOOLEAN' },
  { name: 'class_schedule_enabled', value: 'false', valueType: 'BOOLEAN' },
  { name: 'class_schedule_teacher_overlap_allowed', value: 'true', valueType: 'BOOLEAN' },
  { name: 'class_schedule_visibility', value: 'INTERNAL', valueType: 'TEXT' },
]

/** Une école sans empreinte : aucune confirmation ne s'arme, sauf mention contraire. */
const Panel = (props: Partial<Parameters<typeof SchoolSettingsPanel>[0]> = {}) => (
  <SchoolSettingsPanel
    settings={settings}
    paymentFootprint={{ payments: 0, pendingTransactions: 0 }}
    teacherExpenseCount={0}
    {...props}
  />
)

describe('SchoolSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one labelled row per setting and no way to create another one', () => {
    render(<Panel />)

    expect(screen.getByText('settings.logo_url.label')).toBeInTheDocument()
    expect(screen.getByText('settings.max_students_per_class.label')).toBeInTheDocument()
    expect(screen.getByText('settings.teacher_expenses_enabled.label')).toBeInTheDocument()
    expect(screen.getByText('notConfigured')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'title' })).toHaveLength(2)
    expect(screen.queryByText('create.title')).not.toBeInTheDocument()
  })

  it('gathers the theme colors in a single palette instead of one row each', () => {
    render(<Panel />)

    expect(screen.getAllByRole('button', { name: 'editRole' })).toHaveLength(4)
    expect(screen.queryByText('settings.theme_primary.label')).not.toBeInTheDocument()
    expect(screen.getByText('#3c6e71')).toBeInTheDocument()
  })

  it('saves a boolean setting from its toggle, without sending a value type', async () => {
    vi.mocked(setConfigAction).mockResolvedValue({} as never)
    render(<Panel />)

    fireEvent.click(screen.getByLabelText('settings.teacher_expenses_enabled.label'))

    await waitFor(() =>
      expect(setConfigAction).toHaveBeenCalledWith({
        name: 'teacher_expenses_enabled',
        value: 'true',
      })
    )
  })

  it('asks before cutting payments off a school that already holds one', async () => {
    render(<Panel paymentFootprint={{ payments: 3, pendingTransactions: 0 }} />)

    fireEvent.click(screen.getByLabelText('settings.payments_enabled.label'))

    expect(
      await screen.findByText('settings.payments_enabled.confirmDisable.title')
    ).toBeInTheDocument()
    expect(setConfigAction).not.toHaveBeenCalled()
  })

  it('cuts payments straight off a school that never took any', async () => {
    vi.mocked(setConfigAction).mockResolvedValue({} as never)
    render(<Panel />)

    fireEvent.click(screen.getByLabelText('settings.payments_enabled.label'))

    await waitFor(() =>
      expect(setConfigAction).toHaveBeenCalledWith({ name: 'payments_enabled', value: 'false' })
    )
  })

  it('keeps schedule-dependent settings hidden and inactive until scheduling is enabled', () => {
    const { rerender } = render(<Panel />)

    expect(screen.getByText('settings.class_schedule_enabled.label')).toBeInTheDocument()
    const overlap = screen.getByText('settings.class_schedule_teacher_overlap_allowed.label')
    const visibility = screen.getByText('settings.class_schedule_visibility.label')
    expect(overlap.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')
    expect(visibility.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')

    rerender(
      <Panel
        settings={settings.map((setting) =>
          setting.name === 'class_schedule_enabled' ? { ...setting, value: 'true' } : setting
        )}
      />
    )

    expect(overlap.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
    expect(visibility.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })
})
