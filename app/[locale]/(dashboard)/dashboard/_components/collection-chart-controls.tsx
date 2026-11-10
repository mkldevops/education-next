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
import { Segmented } from './segmented'

interface Props {
  view: ChartView
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
