import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ClassOption } from '../_lib/class-options'
import { ClassSelect } from './class-select'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// Le barrel `@peaklab/ui` importe la navigation localisée, hors de portée de ce test de rendu.
vi.mock('@/i18n/routing', () => ({ Link: () => null, usePathname: () => '/' }))

const period = '2026-2027'
const classes: ClassOption[] = [
  { id: 'ce1-a', name: 'CE1-A', levelId: 'ce1', levelName: 'CE1', periodName: period },
  { id: 'ce1-b', name: 'CE1-B', levelId: 'ce1', levelName: 'CE1', periodName: period },
  { id: 'cp-a', name: 'CP-A', levelId: 'cp', levelName: 'CP', periodName: period },
]

function renderSelect(options: ClassOption[], props: { value?: string; suggested?: string } = {}) {
  render(
    <ClassSelect
      id="class"
      classes={options}
      value={props.value ?? null}
      onValueChange={() => {}}
      suggestedLevelId={props.suggested ?? null}
    />
  )
  fireEvent.click(screen.getByRole('combobox'))
}

const optionTexts = async () =>
  (await screen.findAllByRole('option')).map((option) => option.textContent)

describe('ClassSelect', () => {
  it('shows only the class name under a level header', async () => {
    renderSelect(classes)

    expect(screen.getByText('CE1')).toBeInTheDocument()
    expect(await optionTexts()).toEqual(['CE1-A', 'CE1-B', 'CP-A'])
  })

  it('names the period in an option only when several periods are offered', async () => {
    renderSelect([...classes, { ...classes[0], id: 'ce1-a-next', periodName: '2027-2028' }])

    expect(await optionTexts()).toContain('CE1-A (2027-2028)')
  })

  it('keeps the level in an option when no level header gives it', async () => {
    renderSelect(classes, { suggested: 'cp' })

    expect(await optionTexts()).toEqual(['CP-A (CP)', 'CE1-A (CE1)', 'CE1-B (CE1)'])
  })

  it('keeps the full label in the trigger once a class is chosen', () => {
    renderSelect(classes, { value: 'ce1-a' })

    expect(screen.getByRole('combobox')).toHaveTextContent('CE1-A (CE1 — 2026-2027)')
  })
})
