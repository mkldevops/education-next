export default function StudentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-alabaster-700 rounded w-48" />

      <div className="rounded bg-alabaster-700 h-40" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded bg-alabaster-700 h-48" />
        <div className="rounded bg-alabaster-700 h-48" />
      </div>

      <div>
        <div className="h-8 bg-alabaster-700 rounded w-40 mb-4" />
        <div className="rounded bg-alabaster-700 h-64" />
      </div>
    </div>
  )
}
