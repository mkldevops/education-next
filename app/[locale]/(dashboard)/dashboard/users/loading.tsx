import { Breadcrumbs, Card } from '@peaklab/ui'

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', href: '/dashboard', icon: 'home' },
          { label: 'Utilisateurs' },
        ]}
      />
      <h1 className="text-2xl font-bold text-graphite">Utilisateurs</h1>
      <Card className="rounded border border-alabaster-700">
        <div className="space-y-3 p-6">
          {Array.from({ length: 5 }, (_, i) => i).map((i) => (
            <div key={`loading-${i}`} className="flex gap-4">
              <div className="h-10 w-40 animate-pulse rounded bg-alabaster-700" />
              <div className="h-10 w-40 animate-pulse rounded bg-alabaster-700" />
              <div className="h-10 w-24 animate-pulse rounded bg-alabaster-700" />
              <div className="h-10 flex-1 animate-pulse rounded bg-alabaster-700" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
