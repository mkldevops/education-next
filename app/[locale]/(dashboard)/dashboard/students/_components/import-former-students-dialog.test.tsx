import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormerStudentDraft, FormerStudentPreviewRow } from '@/domain/former-student-import'
import { ImportFormerStudentsDialog } from './import-former-students-dialog'

const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  preview: vi.fn(),
  commit: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key
    t.has = () => true
    return t
  },
}))

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

vi.mock('@/lib/toast', () => ({
  toast: { success: mocks.success, error: mocks.error },
  toastActionError: (_t: unknown, code: string) => mocks.error(code),
}))

vi.mock('../../../_lib/former-student-import-actions', () => ({
  extractFormerStudentsAction: mocks.extract,
  previewFormerStudentsAction: mocks.preview,
  commitFormerStudentsAction: mocks.commit,
}))

const row = (overrides: Partial<FormerStudentDraft>): FormerStudentDraft => ({
  id: 'a',
  lastname: 'Durand',
  firstname: 'Léa',
  birthday: '',
  className: 'CM2',
  departureYear: '2023',
  included: true,
  uncertain: [],
  ...overrides,
})

const rows = [
  row({ id: 'a', uncertain: ['birthday'] }),
  row({ id: 'b', lastname: 'Martin', firstname: 'Hugo' }),
  row({ id: 'c', lastname: '', firstname: 'Sami' }),
  row({ id: 'd', lastname: 'Petit', firstname: 'Noé' }),
]

const preview: FormerStudentPreviewRow[] = [
  { id: 'a', status: 'create', issues: [] },
  { id: 'b', status: 'homonym', issues: [] },
  { id: 'c', status: 'incomplete', issues: ['missingName'] },
  { id: 'd', status: 'existing', issues: [] },
]

async function openReview() {
  render(<ImportFormerStudentsDialog />)
  fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
  const input = screen.getByLabelText('chooseFiles')
  const file = new File(['Nom;Prénom'], 'liste.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
  expect(screen.getByText('liste.csv')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'read' }))
  await screen.findByTestId('chip-create')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.extract.mockResolvedValue({ status: 'OK', rows, preview, truncated: false })
  mocks.preview.mockResolvedValue({ status: 'OK', preview })
  mocks.commit.mockResolvedValue({ status: 'OK', created: 2, skipped: 0 })
})

describe('ImportFormerStudentsDialog', () => {
  it('reads the files, then shows the review with counts and the import button', async () => {
    await openReview()

    const formData = mocks.extract.mock.calls[0]?.[0] as FormData
    expect((formData.getAll('files')[0] as File).name).toBe('liste.csv')
    expect(screen.getByTestId('chip-create')).toHaveTextContent('chips.create:1')
    expect(screen.getByTestId('chip-homonym')).toHaveTextContent('chips.homonym:1')
    expect(screen.getByTestId('chip-existing')).toHaveTextContent('chips.existing:1')
    expect(screen.getByTestId('chip-incomplete')).toHaveTextContent('chips.incomplete:1')
    // Créés et homonymes seulement : l'incomplet et le déjà connu ne comptent pas.
    expect(screen.getByRole('button', { name: 'import:2' })).toBeEnabled()
  })

  it('highlights uncertain cells', async () => {
    await openReview()
    expect(screen.getByLabelText('columns.birthday 1')).toHaveAttribute('data-uncertain', 'true')
    expect(screen.getByLabelText('columns.lastname 1')).not.toHaveAttribute('data-uncertain')
  })

  it('re-runs the preview when an edited cell loses focus', async () => {
    await openReview()
    const cell = screen.getByLabelText('columns.lastname 3')
    fireEvent.change(cell, { target: { value: 'Haddad' } })
    expect(mocks.preview).not.toHaveBeenCalled()
    mocks.preview.mockResolvedValueOnce({
      status: 'OK',
      preview: preview.map((entry) =>
        entry.id === 'c' ? { id: 'c', status: 'create', issues: [] } : entry
      ),
    })
    fireEvent.blur(cell)

    await waitFor(() => expect(screen.getByRole('button', { name: 'import:3' })).toBeEnabled())
    const sent = mocks.preview.mock.calls[0]?.[0] as FormerStudentDraft[]
    expect(sent.find((item) => item.id === 'c')?.lastname).toBe('Haddad')
  })

  it('leaves an unticked row out of the counts and the import', async () => {
    await openReview()
    fireEvent.click(screen.getByLabelText('includeRow:Léa Durand'))

    await waitFor(() => expect(screen.getByRole('button', { name: 'import:1' })).toBeEnabled())
    expect(screen.getByTestId('chip-create')).toHaveTextContent('chips.create:0')
    const sent = mocks.preview.mock.calls[0]?.[0] as FormerStudentDraft[]
    expect(sent.find((item) => item.id === 'a')?.included).toBe(false)
  })

  it('imports on click only, then refreshes the page', async () => {
    await openReview()
    expect(mocks.commit).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'import:2' }))
    })

    expect(mocks.commit).toHaveBeenCalledWith(rows)
    expect(mocks.success).toHaveBeenCalledWith('success:2,0')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('shows the extraction error and stays on the upload step', async () => {
    mocks.extract.mockResolvedValueOnce({ status: 'nothingFound' })
    render(<ImportFormerStudentsDialog />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
    fireEvent.change(screen.getByLabelText('chooseFiles'), {
      target: { files: [new File(['x'], 'liste.csv', { type: 'text/csv' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'read' }))

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('nothingFound'))
    expect(screen.queryByTestId('chip-create')).not.toBeInTheDocument()
  })

  it('refuses more than four files before sending anything', async () => {
    render(<ImportFormerStudentsDialog />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
    const files = Array.from({ length: 5 }, (_, i) => new File(['x'], `f${i}.csv`))
    fireEvent.change(screen.getByLabelText('chooseFiles'), { target: { files } })

    expect(mocks.error).toHaveBeenCalledWith('errors.tooManyFiles')
    expect(screen.getByRole('button', { name: 'read' })).toBeDisabled()
  })
})
