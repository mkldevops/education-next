import type { ReactNode } from 'react'
import { cn } from '../utils'

export interface Column<T> {
  key: string
  header: string
  className?: string
  headerClassName?: string
  render?: (item: T) => ReactNode
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  getRowKey: (item: T) => string
  emptyMessage?: string
  className?: string
}

function getCellValue<T>(item: T, key: string): unknown {
  return (item as Record<string, unknown>)[key]
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  emptyMessage,
  className,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyMessage) {
    return <div className="py-12 text-center text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className={cn('overflow-x-auto rounded', className)}>
      <table className="w-full min-w-[600px]">
        <thead className="bg-gradient-to-br from-primary to-primary/70">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/90',
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={getRowKey(item)} className="relative border-b border-gray-100 last:border-b-0">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-4 text-sm', col.className)}>
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
