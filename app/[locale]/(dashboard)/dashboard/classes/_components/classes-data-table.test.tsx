import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClassesDataTable, type ClassRow } from './classes-data-table'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
// Le menu d'actions ouvre des dialogues adossés à des actions serveur : hors de portée d'un
// test de rendu de la liste.
vi.mock('./class-actions-menu', () => ({ ClassActionsMenu: () => null }))

const levels = [
  { id: 'level-cp', name: 'CP' },
  { id: 'level-ce1', name: 'CE1' },
]

const row = (overrides: Partial<ClassRow>): ClassRow => ({
  id: 'class-1',
  name: 'Classe',
  levelId: 'level-cp',
  levelName: 'CP',
  periodName: '2026-2027',
  teacherNames: [],
  teacherIds: [],
  enrolledCount: 0,
  capacity: 20,
  editableLevels: levels,
  ...overrides,
})

const classes = [
  row({ id: 'a', name: 'Les Lilas', teacherNames: ['Durand Marie'] }),
  row({
    id: 'b',
    name: 'Les Roses',
    levelId: 'level-ce1',
    levelName: 'CE1',
    teacherNames: ['Martin Paul'],
  }),
]

function renderTable() {
  render(
    <ClassesDataTable classes={classes} levels={levels} teachers={[]} emptyMessage="noClasses" />
  )
}

describe('ClassesDataTable', () => {
  it('lists every class with its teachers', () => {
    renderTable()

    expect(screen.getByText('Les Lilas')).toBeInTheDocument()
    expect(screen.getByText('Les Roses')).toBeInTheDocument()
    expect(screen.getByText('Durand Marie')).toBeInTheDocument()
  })

  it('searches classes by name', () => {
    renderTable()

    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'lilas' } })

    expect(screen.getByText('Les Lilas')).toBeInTheDocument()
    expect(screen.queryByText('Les Roses')).not.toBeInTheDocument()
  })

  it('searches classes by teacher name', () => {
    renderTable()

    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'martin' } })

    expect(screen.getByText('Les Roses')).toBeInTheDocument()
    expect(screen.queryByText('Les Lilas')).not.toBeInTheDocument()
  })

  it('filters classes by level', async () => {
    renderTable()

    fireEvent.click(screen.getByRole('combobox', { name: 'filterLevel' }))
    const option = await screen.findByRole('option', { name: 'CE1' })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(screen.getByText('Les Roses')).toBeInTheDocument()
    expect(screen.queryByText('Les Lilas')).not.toBeInTheDocument()
  })

  it('shows the empty message when the period has no class', () => {
    render(<ClassesDataTable classes={[]} levels={levels} teachers={[]} emptyMessage="noClasses" />)

    expect(screen.getByText('noClasses')).toBeInTheDocument()
  })
})
