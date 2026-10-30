import { Card } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

type KPIColor = 'gray' | 'green' | 'amber'

const KPI_COLOR_STYLES: Record<
  KPIColor,
  { bg: string; border: string; text: string; subText: string; iconBg: string; iconText: string }
> = {
  gray: {
    bg: 'bg-alabaster-900',
    border: 'border-alabaster-700',
    text: 'text-graphite',
    subText: 'text-graphite-600',
    iconBg: 'bg-primary-subtle',
    iconText: 'text-foreground',
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
  action?: {
    href: string
    label: string
  }
}

export function KPICard({ label, value, subValue, icon: Icon, color = 'gray', action }: Props) {
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
          <p className="text-xs font-medium text-graphite-600">{label}</p>
          <p className={cn('text-2xl font-bold', text)}>{value}</p>
          {subValue && <p className={cn('text-xs', subText)}>{subValue}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded border border-primary px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus aria-hidden className="size-4" />
            {action.label}
          </Link>
        )}
      </div>
    </Card>
  )
}
