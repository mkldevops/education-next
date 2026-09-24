const bar = 'rounded bg-surface-2'

export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <div className={`h-3.5 w-32 ${bar}`} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className={`h-7 w-48 ${bar}`} />
            <div className={`h-4 w-72 max-w-full ${bar}`} />
          </div>
          <div className="h-9 w-36 rounded-md bg-surface-2" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
        <div className="flex gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className={`h-3 flex-1 ${bar}`} />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="flex gap-4 px-4 py-3.5">
              {Array.from({ length: columns }).map((_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <div key={j} className={`h-4 flex-1 ${bar}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
