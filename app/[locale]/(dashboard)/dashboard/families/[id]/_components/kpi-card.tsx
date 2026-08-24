import { Card } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type KPIColor = 'gray' | 'green' | 'amber'

const KPI_COLOR_STYLES: Record<
  KPIColor,
  { bg: string; border: string; text: string; subText: string; iconBg: string; iconText: string }
> = {
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    subText: 'text-gray-600',
    iconBg: 'bg-primary-light',
    iconText: 'text-primary',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    subText: 'text-green-700',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    subText: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
  },
}

type Props = {
  label: string
  value: string | number
  subValue?: string
  icon?: LucideIcon
  color?: KPIColor
}

export function KPICard({ label, value, subValue, icon: Icon, color = 'gray' }: Props) {
  const { bg, border, text, subText, iconBg, iconText } = KPI_COLOR_STYLES[color]

  return (
    <Card className={cn('p-4', bg, border)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn('shrink-0 rounded p-2.5', iconBg)}>
            <Icon aria-hidden className={cn('size-5', iconText)} />
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={cn('text-2xl font-bold', text)}>{value}</p>
          {subValue && <p className={cn('text-xs', subText)}>{subValue}</p>}
        </div>
      </div>
    </Card>
  )
}
