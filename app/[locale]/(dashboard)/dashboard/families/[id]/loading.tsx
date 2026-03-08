export default function FamilyDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg w-48" />

      <div className="rounded-2xl bg-gray-300 p-8 h-40" />

      <div className="rounded-xl bg-gray-100 p-4 h-12" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gray-200 h-24" />
        <div className="rounded-xl bg-gray-200 h-24" />
        <div className="rounded-xl bg-gray-200 h-24" />
        <div className="rounded-xl bg-gray-200 h-24" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-200 h-40" />
        <div className="rounded-xl bg-gray-200 h-40" />
      </div>

      <div>
        <div className="h-8 bg-gray-200 rounded-lg w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-200 h-48" />
          <div className="rounded-xl bg-gray-200 h-48" />
          <div className="rounded-xl bg-gray-200 h-48" />
        </div>
      </div>

      <div>
        <div className="h-8 bg-gray-200 rounded-lg w-40 mb-4" />
        <div className="rounded-xl bg-gray-200 h-64" />
      </div>
    </div>
  )
}
