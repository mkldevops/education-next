import { Card } from '@peaklab/ui'

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-graphite">{title}</h2>
        <p className="mt-1 text-sm text-graphite-600">{description}</p>
      </div>
      <Card className="divide-y divide-alabaster-700 rounded border border-alabaster-700 p-0">
        {children}
      </Card>
    </section>
  )
}
