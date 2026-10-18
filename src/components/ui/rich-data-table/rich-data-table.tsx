// React Compiler auto-memoization breaks useReactTable's imperative table.setOptions()
// call, silently freezing rendered rows against the data prop. Keep this directive first.
'use no memo'
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
import { useEffect, useState } from 'react'
import { Button } from '../button'
import { Input } from '../input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../utils'

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
  emptyMessage: ReactNode
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  enableSearch?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  initialPageSize?: number
  pageSizeOptions?: number[]
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

/**
 * Préférence partagée par toutes les tables : un choix fait sur une liste vaut pour les autres.
 * Elle est lue après le premier rendu, jamais pendant, sinon le HTML serveur et le client
 * divergeraient.
 */
const PAGE_SIZE_STORAGE_KEY = 'peaklab.table.pageSize'

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
  initialPageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: RichDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false)

  useEffect(() => {
    if (!enablePagination) return
    const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
    if (!pageSizeOptions.includes(stored)) return
    setPagination((current) =>
      current.pageSize === stored ? current : { pageIndex: 0, pageSize: stored }
    )
  }, [enablePagination, pageSizeOptions])

  const effectivePagination = enablePagination
    ? pagination
    : { pageIndex: 0, pageSize: Math.max(data.length, 1) }

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility, pagination: effectivePagination },
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
                <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-alabaster-700 rounded shadow-md p-2 min-w-35">
                  {table.getAllColumns().map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-alabaster-900 rounded"
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

      <div className="overflow-x-auto rounded border border-alabaster-700 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground select-none"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 rounded-sm',
                          header.column.getCanSort() && 'cursor-pointer hover:text-foreground'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span aria-hidden="true">
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
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {globalFilter ? labels.noResults : emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'relative border-b border-border transition-colors last:border-b-0 hover:bg-surface-2',
                    // Contour rentré : un décalage positif serait rogné par le conteneur défilant.
                    onRowClick &&
                      'cursor-pointer focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
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
          <div className="flex items-center gap-2 text-sm text-graphite-600">
            <span>{labels.rowsPerPage}</span>
            <Select
              items={pageSizeOptions.map((size) => ({ value: size, label: String(size) }))}
              value={pagination.pageSize}
              onValueChange={(size) => {
                if (size === null) return
                window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size))
                table.setPageSize(size)
              }}
            >
              <SelectTrigger size="sm" aria-label={labels.rowsPerPage} className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm text-graphite-600">
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
