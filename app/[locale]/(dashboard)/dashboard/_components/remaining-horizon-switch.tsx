'use client'

import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { Segmented } from './segmented'

const HORIZONS = ['month', 'year'] as const
type Horizon = (typeof HORIZONS)[number]

interface Props {
  month: ReactNode
  year: ReactNode
  heading?: ReactNode
  className?: string
  headerClassName?: string
}

export function RemainingHorizonSwitch({
  month,
  year,
  heading,
  className,
  headerClassName,
}: Props) {
  const t = useTranslations('dashboard.remainingHorizon')
  const [horizon, setHorizon] = useState<Horizon>('month')

  return (
    <div className={className}>
      <div className={cn('flex flex-wrap items-center justify-between gap-2', headerClassName)}>
        {heading}
        <Segmented
          label={t('label')}
          options={HORIZONS}
          value={horizon}
          format={(option) => t(option)}
          onSelect={setHorizon}
        />
      </div>
      {horizon === 'month' ? month : year}
    </div>
  )
}
