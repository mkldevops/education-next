import { Card } from '@peaklab/ui'

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
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
