'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setSelectedPeriod } from '@/actions/period-actions'

interface PeriodSelectorProps {
  periods: { id: string; name: string }[]
  selectedPeriodId: string | null
}

export function PeriodSelector({ periods, selectedPeriodId }: PeriodSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (periods.length === 0) return null

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
        aria-label="Sélectionner une période"
        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name}
          </option>
        ))}
      </select>
    </div>
  )
}
