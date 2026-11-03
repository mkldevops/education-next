'use client'

import { useTranslations } from 'next-intl'
import { useOptimistic, useTransition } from 'react'
import {
  CHART_GRANULARITIES,
  CHART_RANGES,
  type ChartView,
  changeChartView,
} from '@/domain/collection-chart'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { saveCollectionChartViewAction } from '../_lib/home-widget-actions'

interface Props {
  view: ChartView
}

function Segmented<T extends string>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string
  options: readonly T[]
  value: T
  format: (option: T) => string
  onSelect: (option: T) => void
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 rounded-lg border-0 bg-surface-2 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => option !== value && onSelect(option)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-(--duration-fast)',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            option === value
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {format(option)}
        </button>
      ))}
    </fieldset>
  )
}

export function CollectionChartControls({ view }: Props) {
  const t = useTranslations('dashboard.insights.chartView')
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useOptimistic(view)

  const select = (change: Partial<ChartView>) => {
    const next = changeChartView(current, change)
    startTransition(async () => {
      setCurrent(next)
      const result = await saveCollectionChartViewAction(next)
      if (result !== 'OK') toast.error(t('error'))
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-60')}>
      <Segmented
        label={t('granularityLabel')}
        options={CHART_GRANULARITIES}
        value={current.granularity}
        format={(option) => t(`granularity.${option}`)}
        onSelect={(granularity) => select({ granularity })}
      />
      <Segmented
        label={t('rangeLabel')}
        options={CHART_RANGES}
        value={current.range}
        format={(option) => t(`range.${option}`)}
        onSelect={(range) => select({ range })}
      />
    </div>
  )
}
