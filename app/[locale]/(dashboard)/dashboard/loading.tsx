export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="-mx-6 -mt-16 bg-gradient-to-br from-primary-light via-primary-light/50 to-alabaster-800 px-6 pb-20 pt-16">
        <div className="h-9 w-64 rounded bg-primary/20" />
        <div className="mt-2 h-5 w-80 rounded bg-primary/10" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {['qa-1', 'qa-2', 'qa-3', 'qa-4'].map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded border border-white/60 bg-white/80 p-4"
            >
              <div className="h-5 w-5 rounded bg-gray-200" />
              <div className="h-5 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="-mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {['stat-1', 'stat-2', 'stat-3', 'stat-4'].map((key) => (
          <div key={key} className="rounded border border-gray-200 bg-white p-5">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="mt-3 h-8 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="mb-6 h-6 w-48 rounded bg-gray-200" />
        <div className="space-y-4">
          {['row-1', 'row-2', 'row-3', 'row-4', 'row-5'].map((key) => (
            <div key={key} className="flex items-center gap-4">
              <div className="h-4 w-28 rounded bg-gray-200" />
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-200" />
              <div className="h-2 flex-1 rounded-full bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
