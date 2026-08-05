import { Card } from '@peaklab/ui'
import { cn } from '@/lib/utils'

type KPIColor = 'gray' | 'green' | 'amber'

const KPI_COLOR_STYLES: Record<KPIColor, { bg: string; text: string; subText: string }> = {
  gray: { bg: 'bg-gray-50', text: 'text-gray-900', subText: 'text-gray-600' },
  green: { bg: 'bg-green-50', text: 'text-green-900', subText: 'text-green-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-900', subText: 'text-amber-700' },
}

type Props = {
  label: string
  value: string | number
  subValue?: string
  icon?: string
  color?: KPIColor
}

export function KPICard({ label, value, subValue, icon, color = 'gray' }: Props) {
  const { bg, text, subText } = KPI_COLOR_STYLES[color]

  return (
    <Card className={cn('p-4 rounded-xl border', bg)}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={cn('text-2xl font-bold', text)}>{value}</p>
          {subValue && <p className={cn('text-xs', subText)}>{subValue}</p>}
        </div>
      </div>
    </Card>
  )
}
