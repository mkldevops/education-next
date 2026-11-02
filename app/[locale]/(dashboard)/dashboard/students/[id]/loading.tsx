export default function StudentDetailLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 w-64 max-w-full rounded bg-alabaster-700" />
      <div className="h-28 rounded-xl bg-alabaster-700" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 rounded-lg bg-alabaster-700" />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="space-y-3">
            <div className="h-6 w-32 rounded bg-alabaster-700" />
            <div className="h-40 rounded-lg bg-alabaster-700" />
          </div>
          <div className="h-96 rounded-lg bg-alabaster-700" />
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-lg bg-alabaster-700" />
          <div className="h-32 rounded-lg bg-alabaster-700" />
        </div>
      </div>
    </div>
  )
}
