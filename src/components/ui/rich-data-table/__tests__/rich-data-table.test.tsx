import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ColumnDef } from '@tanstack/react-table'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RichDataTable, type RichDataTableLabels } from '../rich-data-table'

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}))

type Row = { id: string; name: string }

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }]

const labels: RichDataTableLabels = {
  search: 'Search',
  noResults: 'No results',
  columns: 'Columns',
  rowsPerPage: 'Rows per page',
  previous: 'Previous',
  next: 'Next',
  page: (current, total) => `${current}/${total}`,
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}` }))

describe('RichDataTable', () => {
  it('reflects a changed data prop without a key-forced remount', () => {
    const { rerender } = render(
      <RichDataTable data={rows(3)} columns={columns} labels={labels} emptyMessage="empty" />
    )
    expect(screen.getAllByRole('row')).toHaveLength(4)

    rerender(
      <RichDataTable data={rows(1)} columns={columns} labels={labels} emptyMessage="empty" />
    )
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('keeps showing every row when data grows and pagination is disabled', () => {
    const { rerender } = render(
      <RichDataTable
        data={rows(2)}
        columns={columns}
        labels={labels}
        emptyMessage="empty"
        enablePagination={false}
      />
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)

    rerender(
      <RichDataTable
        data={rows(5)}
        columns={columns}
        labels={labels}
        emptyMessage="empty"
        enablePagination={false}
      />
    )
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })

  it('shows 25 rows per page by default', () => {
    window.localStorage.removeItem('peaklab.table.pageSize')
    render(<RichDataTable data={rows(30)} columns={columns} labels={labels} emptyMessage="empty" />)
    expect(screen.getAllByRole('row')).toHaveLength(26)
  })

  it('restores the page size previously picked by the user', () => {
    window.localStorage.setItem('peaklab.table.pageSize', '10')
    render(<RichDataTable data={rows(30)} columns={columns} labels={labels} emptyMessage="empty" />)
    expect(screen.getAllByRole('row')).toHaveLength(11)
    window.localStorage.removeItem('peaklab.table.pageSize')
  })

  it('changes and remembers the page size picked in the rows-per-page select', async () => {
    window.localStorage.removeItem('peaklab.table.pageSize')
    render(<RichDataTable data={rows(60)} columns={columns} labels={labels} emptyMessage="empty" />)
    expect(screen.getAllByRole('row')).toHaveLength(26)

    fireEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    const option = await screen.findByRole('option', { name: '50' })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(screen.getAllByRole('row')).toHaveLength(51)
    expect(window.localStorage.getItem('peaklab.table.pageSize')).toBe('50')
  })

  it('keeps the "use no memo" directive ahead of every other statement', () => {
    const source = readFileSync(join(__dirname, '../rich-data-table.tsx'), 'utf-8')
    const firstStatement = source
      .split('\n')
      .find((line) => line.trim() !== '' && !line.trim().startsWith('//'))
      ?.trim()

    expect(firstStatement).toBe("'use no memo'")
  })
})
