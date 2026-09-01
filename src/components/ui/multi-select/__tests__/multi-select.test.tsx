import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MultiSelect } from '../multi-select'

const teachers = [
  { id: '1', name: 'Chanrani Anissa' },
  { id: '2', name: 'Mohamed Rasmia' },
  { id: '3', name: 'Said Djamael' },
]

function renderMultiSelect(defaultValue?: string[]) {
  return render(
    <form aria-label="class form">
      <MultiSelect
        name="teacherIds"
        options={teachers}
        defaultValue={defaultValue}
        placeholder="Rechercher un enseignant..."
        noResultsMessage="Aucun enseignant trouvé"
        removeLabel="Retirer"
      />
    </form>
  )
}

function submittedIds() {
  const form = screen.getByRole('form') as HTMLFormElement
  return new FormData(form).getAll('teacherIds').map(String)
}

describe('MultiSelect', () => {
  it('filters options with an accent-insensitive search', () => {
    renderMultiSelect()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'anissa' } })

    expect(screen.getByRole('option', { name: /Chanrani Anissa/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Mohamed Rasmia/ })).toBeNull()
  })

  it('submits every selected option under the field name', () => {
    renderMultiSelect()

    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Chanrani Anissa/ }))
    fireEvent.click(screen.getByRole('option', { name: /Said Djamael/ }))

    expect(submittedIds()).toEqual(['1', '3'])
  })

  it('preselects the default value and removes a selection from its chip', () => {
    renderMultiSelect(['2'])

    expect(submittedIds()).toEqual(['2'])

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Mohamed Rasmia' }))

    expect(submittedIds()).toEqual([])
  })

  it('selects the active option with the keyboard', () => {
    renderMultiSelect()

    const combobox = screen.getByRole('combobox')
    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(submittedIds()).toEqual(['2'])
  })

  it('shows the no-results message when nothing matches', () => {
    renderMultiSelect()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })

    expect(screen.getByText('Aucun enseignant trouvé')).toBeInTheDocument()
  })
})
