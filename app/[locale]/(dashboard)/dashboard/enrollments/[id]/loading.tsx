export default function EnrollmentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg w-48" />

      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="h-9 bg-gray-200 rounded w-40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-gray-200 h-40" />
        <div className="rounded-xl bg-gray-200 h-40" />
      </div>

      <div className="rounded-xl bg-gray-200 h-48" />
      <div className="rounded-xl bg-gray-200 h-48" />
    </div>
  )
}
