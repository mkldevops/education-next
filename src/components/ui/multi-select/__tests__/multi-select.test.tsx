import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../dialog/dialog'
import { MultiSelect } from '../multi-select'

const teachers = [
  { id: '1', name: 'Chanrani Anissa' },
  { id: '2', name: 'Mohamed Rasmia' },
  { id: '3', name: 'Aïcha Bénédicte' },
]

function renderMultiSelect(props?: { defaultValue?: string[]; options?: typeof teachers }) {
  return render(
    <form aria-label="class form">
      <MultiSelect
        name="teacherIds"
        options={props?.options ?? teachers}
        defaultValue={props?.defaultValue}
        placeholder="Rechercher un enseignant..."
        emptyMessage="Aucun enseignant disponible"
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
  it('filters options ignoring case and diacritics', () => {
    renderMultiSelect()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'aicha' } })

    expect(screen.getByRole('option', { name: /Aïcha Bénédicte/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Mohamed Rasmia/ })).toBeNull()
  })

  it('submits every selected option under the field name', () => {
    renderMultiSelect()

    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Chanrani Anissa/ }))
    fireEvent.click(screen.getByRole('option', { name: /Aïcha Bénédicte/ }))

    expect(submittedIds()).toEqual(['1', '3'])
  })

  it('deselects an option that is already selected', () => {
    renderMultiSelect({ defaultValue: ['1'] })

    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Chanrani Anissa/ }))

    expect(submittedIds()).toEqual([])
  })

  it('preselects the default value and removes a selection from its chip', () => {
    renderMultiSelect({ defaultValue: ['2'] })

    expect(submittedIds()).toEqual(['2'])

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Mohamed Rasmia' }))

    expect(submittedIds()).toEqual([])
  })

  it('never submits an id that is absent from the options', () => {
    renderMultiSelect({ defaultValue: ['2', 'deactivated-teacher'] })

    expect(submittedIds()).toEqual(['2'])
  })

  it('removes the last selection with Backspace on an empty query', () => {
    renderMultiSelect({ defaultValue: ['1', '2'] })

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })

    expect(submittedIds()).toEqual(['1'])
  })

  it('selects the active option with the keyboard and exposes it as active descendant', () => {
    renderMultiSelect()

    const combobox = screen.getByRole('combobox')
    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'ArrowDown' })

    const activeId = combobox.getAttribute('aria-activedescendant')
    expect(activeId).toBe(screen.getByRole('option', { name: /Mohamed Rasmia/ }).id)

    fireEvent.keyDown(combobox, { key: 'Enter' })
    expect(submittedIds()).toEqual(['2'])
  })

  it('does not select anything when Enter is pressed without an active option', () => {
    renderMultiSelect()

    const combobox = screen.getByRole('combobox')
    fireEvent.focus(combobox)
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(submittedIds()).toEqual([])
  })

  it('keeps option buttons out of the tab order', () => {
    renderMultiSelect()

    fireEvent.focus(screen.getByRole('combobox'))

    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('tabindex', '-1')
    }
  })

  it('shows the no-results message when nothing matches', () => {
    renderMultiSelect()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })

    expect(screen.getByText('Aucun enseignant trouvé')).toBeInTheDocument()
  })

  it('disables the field and shows the empty message without options', () => {
    renderMultiSelect({ options: [] })

    const combobox = screen.getByRole('combobox')
    expect(combobox).toBeDisabled()
    expect(combobox).toHaveAttribute('placeholder', 'Aucun enseignant disponible')

    fireEvent.focus(combobox)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('MultiSelect inside a Dialog', () => {
  function renderInDialog() {
    render(
      <Dialog>
        <DialogTrigger>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la classe</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <MultiSelect
              name="teacherIds"
              options={teachers}
              placeholder="Rechercher un enseignant..."
              noResultsMessage="Aucun enseignant trouvé"
              removeLabel="Retirer"
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  }

  it('closes only the option list when Escape is pressed with the list open', () => {
    renderInDialog()

    const combobox = screen.getByRole('combobox')
    fireEvent.focus(combobox)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(combobox, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('still closes the dialog on Escape when the option list is closed', () => {
    renderInDialog()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('MultiSelect creation', () => {
  function renderCreatable(
    onCreate: (query: string) => Promise<{ id: string; name: string } | null>
  ) {
    return render(
      <form aria-label="class form">
        <MultiSelect
          name="teacherIds"
          options={teachers}
          onCreate={onCreate}
          createLabel={(query) => `Créer « ${query} »`}
        />
      </form>
    )
  }

  it('creates and selects a missing option from the query', async () => {
    const onCreate = vi.fn(async (query: string) => ({ id: '9', name: query }))
    renderCreatable(onCreate)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: ' Kaniza ' } })
    fireEvent.click(screen.getByRole('option', { name: /Créer « Kaniza »/ }))

    await waitFor(() => expect(submittedIds()).toEqual(['9']))
    expect(onCreate).toHaveBeenCalledWith('Kaniza')
  })

  it('creates the option with Enter once it is the active item', async () => {
    const onCreate = vi.fn(async (query: string) => ({ id: '9', name: query }))
    renderCreatable(onCreate)

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Rahma' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(submittedIds()).toEqual(['9']))
  })

  it('offers no creation when an option already has that exact name', () => {
    renderCreatable(vi.fn())

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'chanrani anissa' } })

    expect(screen.queryByRole('option', { name: /Créer/ })).toBeNull()
  })

  it('selects nothing when the creation fails', async () => {
    const onCreate = vi.fn(async () => null)
    renderCreatable(onCreate)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Kaniza' } })
    fireEvent.click(screen.getByRole('option', { name: /Créer « Kaniza »/ }))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(submittedIds()).toEqual([])
  })
})
