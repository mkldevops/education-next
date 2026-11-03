const bar = 'rounded bg-surface-2'
const panel = 'rounded-lg border border-border bg-surface shadow-xs'

function PanelSkeleton({ rows, className }: { rows: string[]; className?: string }) {
  return (
    <div className={`${panel} ${className ?? ''}`}>
      <div className="flex min-h-12 items-center border-b border-border px-4 py-3 sm:px-5">
        <div className={`h-4 w-36 ${bar}`} />
      </div>
      <div className="space-y-1 p-2 sm:p-3">
        {rows.map((key) => (
          <div key={key} className="flex items-center gap-3 px-3 py-2.5">
            <div className="size-8 shrink-0 rounded-md bg-surface-2" />
            <div className="flex-1 space-y-1.5">
              <div className={`h-3.5 w-2/3 ${bar}`} />
              <div className={`h-3 w-1/3 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6 sm:space-y-8" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className={`h-7 w-64 max-w-full ${bar}`} />
          <div className={`h-4 w-80 max-w-full ${bar}`} />
        </div>
        <div className="h-9 w-40 rounded-md bg-surface-2" />
      </div>

      <div className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-xs lg:grid-cols-5">
        <div className="space-y-5 border-b border-border p-5 sm:p-6 lg:col-span-3 lg:border-r lg:border-b-0">
          <div className={`h-3 w-28 ${bar}`} />
          <div className="space-y-2">
            <div className={`h-4 w-32 ${bar}`} />
            <div className={`h-12 w-64 max-w-full ${bar}`} />
          </div>
          <div className="h-2.5 rounded-full bg-surface-2" />
        </div>
        <div className="divide-y divide-border lg:col-span-2">
          {['line-1', 'line-2', 'line-3'].map((key) => (
            <div key={key} className="space-y-2 px-5 py-4 sm:px-6">
              <div className={`h-4 w-2/3 ${bar}`} />
              <div className="h-1 rounded-full bg-surface-2" />
              <div className={`h-3 w-1/2 ${bar}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <PanelSkeleton rows={['todo-1', 'todo-2', 'todo-3']} />
          <div className={`${panel} grid grid-cols-3 divide-x divide-border`}>
            {['count-1', 'count-2', 'count-3'].map((key) => (
              <div key={key} className="space-y-2 p-4 sm:p-5">
                <div className={`h-3 w-16 ${bar}`} />
                <div className={`h-7 w-12 ${bar}`} />
              </div>
            ))}
          </div>
        </div>
        <PanelSkeleton rows={['class-1', 'class-2', 'class-3']} className="lg:col-span-2" />
      </div>
    </div>
  )
}
