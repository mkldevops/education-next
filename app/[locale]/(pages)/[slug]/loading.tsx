export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="h-[60vh] bg-gray-200" />
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <div className="h-8 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
      </div>
    </div>
  )
}
