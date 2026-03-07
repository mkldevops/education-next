'use client'

import { type ReactNode, useState } from 'react'
import { cn } from '../utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (item: T) => ReactNode
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  getRowKey: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
  className?: string
}

type SortDirection = 'asc' | 'desc'

function getCellValue<T>(item: T, key: string): unknown {
  return (item as Record<string, unknown>)[key]
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  emptyMessage,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const aVal = getCellValue(a, sortKey)
        const bVal = getCellValue(b, sortKey)
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  if (data.length === 0 && emptyMessage) {
    return <div className="rounded-lg border p-8 text-center text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-gray-200 bg-white', className)}>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-sm font-medium text-gray-500',
                  col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                  col.className
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((item) => (
            <tr
              key={getRowKey(item)}
              className={cn('hover:bg-gray-50', onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-sm', col.className)}>
                  {col.render ? col.render(item) : String(getCellValue(item, col.key) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
