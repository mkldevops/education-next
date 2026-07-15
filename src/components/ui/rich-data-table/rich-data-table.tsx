'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/components/ui/utils'

export interface RichDataTableLabels {
  search: string
  noResults: string
  columns: string
  rowsPerPage: string
  previous: string
  next: string
  page: (current: number, total: number) => string
}

export interface RichDataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  labels: RichDataTableLabels
  emptyMessage: string
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  enableSearch?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  initialPageSize?: number
  pageSizeOptions?: number[]
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

export function RichDataTable<T>({
  data,
  columns,
  labels,
  emptyMessage,
  toolbar,
  onRowClick,
  enableSearch = true,
  enableColumnVisibility = true,
  enablePagination = true,
  initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: RichDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: enablePagination ? initialPageSize : Math.max(data.length, 1),
  })
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false)

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  })

  const totalPages = table.getPageCount()
  const currentPage = pagination.pageIndex + 1

  return (
    <div className="space-y-4">
      {(enableSearch || enableColumnVisibility || toolbar) && (
        <div className="flex items-center gap-3 flex-wrap">
          {enableSearch && (
            <Input
              placeholder={labels.search}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          )}
          {toolbar}
          {enableColumnVisibility && (
            <div className="relative ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setColumnVisibilityOpen((v) => !v)}
              >
                {labels.columns}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {columnVisibilityOpen && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-md shadow-md p-2 min-w-[140px]">
                  {table.getAllColumns().map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-gray-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                      />
                      {col.columnDef.header as string}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-600 select-none"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer hover:text-gray-900'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                  {globalFilter ? labels.noResults : emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    onRowClick &&
                      'cursor-pointer focus-visible:outline-none focus-visible:bg-gray-50'
                  )}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row.original)
                          }
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{labels.rowsPerPage}</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{labels.page(currentPage, totalPages || 1)}</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {labels.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {labels.next}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
