'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { setSelectedPeriod } from '@/actions/period-actions'
import { isPeriodCurrent } from '@/domain/period'

interface PeriodSelectorProps {
  periods: { id: string; name: string; startAt: Date; endAt: Date }[]
  selectedPeriodId: string | null
}

export function PeriodSelector({ periods, selectedPeriodId }: PeriodSelectorProps) {
  const t = useTranslations('dashboard.pages.periods')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (periods.length === 0) return null

  const now = new Date()
  const currentPeriodId = periods.find((period) => isPeriodCurrent(period, now))?.id ?? null

  const periodItems = periods.map((period) => ({
    value: period.id,
    label: period.id === currentPeriodId ? `${period.name} — ${t('current')}` : period.name,
  }))

  const handleChange = (value: string | null) => {
    if (value === null) return
    startTransition(async () => {
      await setSelectedPeriod(value)
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        items={periodItems}
        value={selectedPeriodId}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger
          aria-label={t('selectAriaLabel')}
          className="h-11 min-w-0 w-auto max-w-full sm:max-w-44 md:h-9 rounded-md border-border bg-surface pl-2.5 font-medium text-foreground shadow-xs transition-colors hover:border-input/60 lg:max-w-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentPeriodId === null && (
        <span className="hidden text-xs text-warning lg:inline">{t('betweenYears')}</span>
      )}
    </div>
  )
}
