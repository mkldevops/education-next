'use client'

import { useRouter } from 'next/navigation'
import { setSelectedPeriod } from '@/actions/period-actions'

interface PeriodSelectorProps {
  periods: { id: string; name: string }[]
  selectedPeriodId: string | null
}

export function PeriodSelector({ periods, selectedPeriodId }: PeriodSelectorProps) {
  const router = useRouter()

  if (periods.length === 0) return null

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await setSelectedPeriod(e.target.value)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedPeriodId ?? ''}
        onChange={handleChange}
        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
