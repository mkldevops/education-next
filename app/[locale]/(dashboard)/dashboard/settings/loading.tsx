export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 rounded bg-alabaster-700" />
      <div className="flex gap-2 border-b border-alabaster-700 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="h-8 w-24 rounded bg-alabaster-700" />
        ))}
      </div>
      <div className="rounded border border-alabaster-700 bg-white p-6">
        <div className="h-6 w-32 rounded bg-alabaster-700" />
        <div className="mt-2 h-4 w-64 rounded bg-alabaster-700" />
        <div className="mt-6 max-w-md space-y-4">
          <div className="h-10 rounded bg-alabaster-700" />
          <div className="h-10 rounded bg-alabaster-700" />
          <div className="h-10 w-24 rounded bg-alabaster-700" />
        </div>
      </div>
    </div>
  )
}
