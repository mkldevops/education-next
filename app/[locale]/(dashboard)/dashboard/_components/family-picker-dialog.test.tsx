import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FamilyPickerDialog } from './family-picker-dialog'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// Le barrel `@peaklab/ui` charge `DialogRouteOpener`, donc la navigation localisée.
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ replace: vi.fn() }) }))

const families = [
  { id: 'family-1', name: 'Benali' },
  { id: 'family-2', name: 'Durand' },
  { id: 'family-3', name: 'Lefèvre' },
]

function renderPicker() {
  return render(
    <FamilyPickerDialog
      families={families}
      label="Ajouter un élève"
      renderDialog={(family) => <p>{`dialog:${family.id}`}</p>}
    />
  )
}

describe('FamilyPickerDialog', () => {
  it('asks for the family before opening the target dialog', () => {
    renderPicker()

    expect(screen.queryByText(/^dialog:/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un élève' }))
    fireEvent.click(screen.getByRole('button', { name: 'Durand' }))

    expect(screen.getByText('dialog:family-2')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters families by name, ignoring case and accents', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un élève' }))
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'LEFEV' } })

    expect(screen.getByRole('button', { name: 'Lefèvre' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Benali' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'zzz' } })
    expect(screen.getByText('noResults')).toBeInTheDocument()
  })

  it('reopens the target dialog when the same family is picked again after closing it', () => {
    function Target({ id }: { id: string }) {
      const [open, setOpen] = useState(true)
      if (!open) return null
      return (
        <button type="button" onClick={() => setOpen(false)}>
          {`close:${id}`}
        </button>
      )
    }
    render(
      <FamilyPickerDialog
        families={families}
        label="Enregistrer un règlement"
        renderDialog={(family) => <Target id={family.id} />}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un règlement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Benali' }))
    fireEvent.click(screen.getByRole('button', { name: 'close:family-1' }))
    expect(screen.queryByRole('button', { name: 'close:family-1' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un règlement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Benali' }))

    expect(screen.getByRole('button', { name: 'close:family-1' })).toBeInTheDocument()
  })

  it('explains that a family must exist first when the school has none', () => {
    render(<FamilyPickerDialog families={[]} label="Ajouter un élève" renderDialog={() => null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un élève' }))

    expect(screen.getByText('noFamilies')).toBeInTheDocument()
    expect(screen.queryByLabelText('search')).not.toBeInTheDocument()
  })
})
