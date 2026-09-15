import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../../_lib/config-actions', () => ({ setConfigAction: vi.fn() }))

import { setConfigAction } from '../../../_lib/config-actions'
import { type SchoolSetting, SchoolSettingsPanel } from './school-settings-panel'

const settings: SchoolSetting[] = [
  { name: 'theme_primary', value: '#3c6e71', valueType: 'COLOR' },
  { name: 'theme_background', value: '', valueType: 'COLOR' },
  { name: 'teacher_expenses_enabled', value: 'false', valueType: 'BOOLEAN' },
]

describe('SchoolSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one labelled row per setting and no way to create another one', () => {
    render(<SchoolSettingsPanel settings={settings} />)

    expect(screen.getByText('settings.theme_primary.label')).toBeInTheDocument()
    expect(screen.getByText('settings.theme_background.label')).toBeInTheDocument()
    expect(screen.getByText('settings.teacher_expenses_enabled.label')).toBeInTheDocument()
    expect(screen.getByText('#3c6e71')).toBeInTheDocument()
    expect(screen.getByText('notConfigured')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'title' })).toHaveLength(2)
    expect(screen.queryByText('create.title')).not.toBeInTheDocument()
  })

  it('saves a boolean setting from its toggle, without sending a value type', async () => {
    vi.mocked(setConfigAction).mockResolvedValue({} as never)
    render(<SchoolSettingsPanel settings={settings} />)

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() =>
      expect(setConfigAction).toHaveBeenCalledWith({
        name: 'teacher_expenses_enabled',
        value: 'true',
      })
    )
  })
})
