export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-48 rounded bg-alabaster-700" />
      <div className="h-8 w-56 rounded bg-alabaster-700" />
      <div className="rounded border border-alabaster-700 bg-white p-6">
        <div className="h-6 w-40 rounded bg-alabaster-700" />
        <div className="mt-2 h-4 w-72 rounded bg-alabaster-700" />
        <div className="mt-4 h-4 w-32 rounded bg-alabaster-700" />
      </div>
    </div>
  )
}
