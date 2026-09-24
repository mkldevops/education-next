'use client'

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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    startTransition(async () => {
      await setSelectedPeriod(value)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedPeriodId ?? ''}
        onChange={handleChange}
        disabled={isPending}
        aria-label={t('selectAriaLabel')}
        className="h-9 max-w-[11rem] truncate rounded-md border border-border bg-surface pl-2.5 pr-8 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-input/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:max-w-none"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.id === currentPeriodId ? `${period.name} — ${t('current')}` : period.name}
          </option>
        ))}
      </select>
      {currentPeriodId === null && (
        <span className="hidden text-xs text-warning lg:inline">{t('betweenYears')}</span>
      )}
    </div>
  )
}
