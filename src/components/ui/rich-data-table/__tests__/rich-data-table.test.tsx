import type { ColumnDef } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
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
})
