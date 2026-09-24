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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {['kpi-1', 'kpi-2', 'kpi-3', 'kpi-4'].map((key) => (
          <div key={key} className={`${panel} space-y-3 p-4 sm:p-5`}>
            <div className={`h-4 w-24 ${bar}`} />
            <div className={`h-7 w-16 ${bar}`} />
            <div className={`h-3 w-28 ${bar}`} />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <PanelSkeleton rows={['todo-1', 'todo-2', 'todo-3']} className="lg:col-span-3" />
        <PanelSkeleton rows={['class-1', 'class-2', 'class-3']} className="lg:col-span-2" />
      </div>

      <div className={panel}>
        <div className="flex min-h-12 items-center border-b border-border px-4 py-3 sm:px-5">
          <div className={`h-4 w-44 ${bar}`} />
        </div>
        <div className="divide-y divide-border">
          {['row-1', 'row-2', 'row-3', 'row-4', 'row-5'].map((key) => (
            <div key={key} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <div className={`h-4 w-32 ${bar}`} />
              <div className={`h-4 w-24 ${bar}`} />
              <div className={`h-5 w-16 rounded-full bg-surface-2`} />
              <div className="h-1.5 flex-1 rounded-full bg-surface-2" />
              <div className={`h-4 w-20 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
