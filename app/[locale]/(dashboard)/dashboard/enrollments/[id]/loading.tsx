export default function EnrollmentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-alabaster-700 rounded w-48" />

      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 bg-alabaster-700 rounded w-64" />
          <div className="h-4 bg-alabaster-700 rounded w-40" />
        </div>
        <div className="h-9 bg-alabaster-700 rounded w-40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded bg-alabaster-700 h-40" />
        <div className="rounded bg-alabaster-700 h-40" />
      </div>

      <div className="rounded bg-alabaster-700 h-48" />
      <div className="rounded bg-alabaster-700 h-48" />
    </div>
  )
}
