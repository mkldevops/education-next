export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="h-8 w-64 max-w-full rounded bg-alabaster-700" />
          <div className="mt-2 h-5 w-80 max-w-full rounded bg-alabaster-700" />
        </div>
        <div className="h-10 w-40 rounded-md bg-alabaster-700" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {['stat-1', 'stat-2', 'stat-3', 'stat-4'].map((key) => (
          <div key={key} className="rounded border border-alabaster-700 bg-white p-5">
            <div className="h-4 w-20 rounded bg-alabaster-700" />
            <div className="mt-3 h-8 w-12 rounded bg-alabaster-700" />
          </div>
        ))}
      </div>

      <div className="rounded border border-alabaster-700 bg-white p-6">
        <div className="mb-6 h-6 w-48 rounded bg-alabaster-700" />
        <div className="space-y-4">
          {['row-1', 'row-2', 'row-3', 'row-4', 'row-5'].map((key) => (
            <div key={key} className="flex items-center gap-4">
              <div className="h-4 w-28 rounded bg-alabaster-700" />
              <div className="h-4 w-24 rounded bg-alabaster-700" />
              <div className="h-4 w-16 rounded bg-alabaster-700" />
              <div className="h-2 flex-1 rounded-full bg-alabaster-700" />
              <div className="h-4 w-20 rounded bg-alabaster-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
