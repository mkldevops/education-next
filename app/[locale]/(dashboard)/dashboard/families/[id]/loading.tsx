export default function FamilyDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-alabaster-700 rounded w-48" />

      <div className="rounded bg-alabaster p-8 h-40" />

      <div className="rounded bg-alabaster-800 p-4 h-12" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded bg-alabaster-700 h-24" />
        <div className="rounded bg-alabaster-700 h-24" />
        <div className="rounded bg-alabaster-700 h-24" />
        <div className="rounded bg-alabaster-700 h-24" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded bg-alabaster-700 h-40" />
        <div className="rounded bg-alabaster-700 h-40" />
      </div>

      <div>
        <div className="h-8 bg-alabaster-700 rounded w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded bg-alabaster-700 h-48" />
          <div className="rounded bg-alabaster-700 h-48" />
          <div className="rounded bg-alabaster-700 h-48" />
        </div>
      </div>

      <div>
        <div className="h-8 bg-alabaster-700 rounded w-40 mb-4" />
        <div className="rounded bg-alabaster-700 h-64" />
      </div>
    </div>
  )
}
