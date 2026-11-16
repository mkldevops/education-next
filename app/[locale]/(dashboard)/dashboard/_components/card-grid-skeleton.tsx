const bar = 'rounded bg-surface-2'

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <div className={`h-3.5 w-32 ${bar}`} />
        <div className="space-y-2">
          <div className={`h-7 w-48 ${bar}`} />
          <div className={`h-4 w-72 max-w-full ${bar}`} />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            key={i}
            className="space-y-3 rounded-lg border border-border bg-surface p-5 shadow-xs"
          >
            <div className={`h-5 w-2/3 ${bar}`} />
            <div className={`h-3.5 w-1/2 ${bar}`} />
            <div className={`h-3.5 w-1/3 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
