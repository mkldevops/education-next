'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { Segmented } from './segmented'

export const HORIZONS = ['month', 'year'] as const
export type Horizon = (typeof HORIZONS)[number]

export const HORIZON_PARAM = 'horizon'

export function readHorizon(value: string | null | undefined): Horizon {
  return value === 'year' ? 'year' : 'month'
}

/**
 * Horizon porté par l'URL : le lien du tableau de bord ouvre la page sur la vue choisie, et chaque
 * bascule de la page la garde à jour sans recharger les données du serveur.
 */
export function useUrlHorizon(): [Horizon, (horizon: Horizon) => void] {
  const searchParams = useSearchParams()
  const horizon = readHorizon(searchParams.get(HORIZON_PARAM))
  const setHorizon = (next: Horizon) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(HORIZON_PARAM, next)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }
  return [horizon, setHorizon]
}

export function HorizonSegmented({
  value,
  onSelect,
}: {
  value: Horizon
  onSelect: (horizon: Horizon) => void
}) {
  const t = useTranslations('dashboard.remainingHorizon')
  return (
    <Segmented
      label={t('label')}
      options={HORIZONS}
      value={value}
      format={(option) => t(option)}
      onSelect={onSelect}
    />
  )
}

interface Props {
  month: ReactNode
  year: ReactNode
  heading?: ReactNode
  className?: string
  headerClassName?: string
  /** Partage l'horizon avec les autres bascules de la page via le paramètre `horizon`. */
  synced?: boolean
}

export function RemainingHorizonSwitch({ synced = false, ...props }: Props) {
  return synced ? <UrlSwitch {...props} /> : <LocalSwitch {...props} />
}

function LocalSwitch(props: Omit<Props, 'synced'>) {
  const [horizon, setHorizon] = useState<Horizon>('month')
  return <SwitchView {...props} horizon={horizon} onSelect={setHorizon} />
}

function UrlSwitch(props: Omit<Props, 'synced'>) {
  const [horizon, setHorizon] = useUrlHorizon()
  return <SwitchView {...props} horizon={horizon} onSelect={setHorizon} />
}

function SwitchView({
  month,
  year,
  heading,
  className,
  headerClassName,
  horizon,
  onSelect,
}: Omit<Props, 'synced'> & { horizon: Horizon; onSelect: (horizon: Horizon) => void }) {
  return (
    <div className={className}>
      <div className={cn('flex flex-wrap items-center justify-between gap-2', headerClassName)}>
        {heading}
        <HorizonSegmented value={horizon} onSelect={onSelect} />
      </div>
      {horizon === 'month' ? month : year}
    </div>
  )
}
