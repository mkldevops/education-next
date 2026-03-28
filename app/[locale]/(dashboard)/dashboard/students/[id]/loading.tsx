export default function StudentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg w-48" />

      <div className="rounded-xl bg-gray-200 h-40" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-200 h-48" />
        <div className="rounded-xl bg-gray-200 h-48" />
      </div>

      <div>
        <div className="h-8 bg-gray-200 rounded-lg w-40 mb-4" />
        <div className="rounded-xl bg-gray-200 h-64" />
      </div>
    </div>
  )
}
