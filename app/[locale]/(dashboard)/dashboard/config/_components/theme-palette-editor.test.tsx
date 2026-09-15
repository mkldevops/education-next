import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string, values?: Record<string, string>) => values?.role ?? key, {
      has: () => true,
    }),
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  toastActionError: vi.fn(),
}))
vi.mock('../../../_lib/config-actions', () => ({ setThemeColorsAction: vi.fn() }))

import { THEME_PALETTES } from '@/lib/theme-palettes'
import { toastActionError } from '@/lib/toast'
import { setThemeColorsAction } from '../../../_lib/config-actions'
import { ThemePaletteEditor } from './theme-palette-editor'

describe('ThemePaletteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows stored colors and marks the ones still derived from the primary', () => {
    render(<ThemePaletteEditor colors={{ theme_primary: '#3C6E71', theme_background: '' }} />)

    expect(screen.getByText('#3c6e71')).toBeInTheDocument()
    expect(screen.getAllByText('auto')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled()
  })

  it('offers ten ready-made palettes that fill the four colors at once', () => {
    render(<ThemePaletteEditor colors={{ theme_primary: '#3c6e71' }} />)
    const toggle = screen.getByRole('button', { name: 'presets' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /^palettes\./ })).not.toBeInTheDocument()

    fireEvent.click(toggle)

    const presets = screen.getAllByRole('button', { name: /^palettes\./ })
    expect(presets).toHaveLength(10)

    fireEvent.click(screen.getByRole('button', { name: 'palettes.burgundy' }))

    expect(screen.getByRole('button', { name: 'palettes.burgundy' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.queryByText('auto')).not.toBeInTheDocument()
    expect(screen.getByText('#540b0e')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^presets.*palettes\.burgundy/ })).toBeInTheDocument()
  })

  it('saves only the colors that changed, in one call', async () => {
    vi.mocked(setThemeColorsAction).mockResolvedValue('OK')
    const burgundy = THEME_PALETTES.find((palette) => palette.id === 'burgundy')
    render(
      <ThemePaletteEditor colors={{ theme_primary: '#9e2a2b', theme_background: '#fffdf5' }} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'presets' }))
    fireEvent.click(screen.getByRole('button', { name: 'palettes.burgundy' }))
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(setThemeColorsAction).toHaveBeenCalledWith({
        colors: {
          theme_primary_hover: burgundy?.colors.theme_primary_hover,
          theme_primary_light: burgundy?.colors.theme_primary_light,
        },
      })
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('opens a picker for a color and discards the draft on reset', () => {
    render(<ThemePaletteEditor colors={{ theme_primary: '#3c6e71' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'roles.theme_primary.label' }))
    const hex = screen.getByLabelText('hex')
    fireEvent.change(hex, { target: { value: '#123456' } })

    expect(screen.getAllByText('#123456').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'reset' }))

    expect(screen.getByText('#3c6e71')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reset' })).toBeDisabled()
  })

  it('reports a refused save without refreshing', async () => {
    vi.mocked(setThemeColorsAction).mockResolvedValue('invalidConfigValue')
    render(<ThemePaletteEditor colors={{ theme_primary: '#3c6e71' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'presets' }))
    fireEvent.click(screen.getByRole('button', { name: 'palettes.slate' }))
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(toastActionError).toHaveBeenCalledWith(expect.anything(), 'invalidConfigValue')
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
