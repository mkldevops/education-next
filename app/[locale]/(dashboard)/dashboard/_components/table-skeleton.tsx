export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-alabaster-700" />
        <div className="h-10 w-36 rounded bg-alabaster-700" />
      </div>
      <div className="overflow-hidden rounded border border-alabaster-700 bg-white">
        <div className="border-b bg-alabaster-900 px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="h-4 flex-1 rounded bg-alabaster-700" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="flex gap-4 px-4 py-3">
              {Array.from({ length: columns }).map((_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <div key={j} className="h-4 flex-1 rounded bg-alabaster-700" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
