import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const switchSchoolAction = vi.fn(async (_schoolId: string) => 'OK' as const)
const refresh = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
// Le baril `@peaklab/ui` tire la navigation localisée, que Node ne résout pas hors
// du bundler Next. Rien ici n'en dépend.
vi.mock('@/i18n/routing', () => ({
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ refresh }),
}))
vi.mock('@/actions/school-actions', () => ({
  switchSchoolAction: (schoolId: string) => switchSchoolAction(schoolId),
}))

const { SchoolSwitchPrompt } = await import('./school-switch-prompt')

const renderPrompt = (canSwitch: boolean) =>
  render(<SchoolSwitchPrompt schoolId="school-b" schoolName="Horizon" canSwitch={canSwitch} />)

describe('SchoolSwitchPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    switchSchoolAction.mockResolvedValue('OK' as const)
  })

  it('offers the switch when the caller may switch', async () => {
    renderPrompt(true)

    fireEvent.click(screen.getByRole('button', { name: 'switchTo' }))

    await waitFor(() => expect(switchSchoolAction).toHaveBeenCalledWith('school-b'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('drops the switch when the platform flag is off', () => {
    renderPrompt(false)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('switchDisabled')).toBeInTheDocument()
  })
})
