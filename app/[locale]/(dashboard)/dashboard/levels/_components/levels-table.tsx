'use client'

import { Card, type Column, DataTable } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { GenerateClassDialog } from './generate-class-dialog'
import { LevelActionsMenu } from './level-actions-menu'

export type LevelRow = {
  id: string
  name: string
  nextLevelId: string | null
  nextLevelName: string | null
  classCount: number
  /** Classes du niveau sur la période sélectionnée. */
  currentClasses: { id: string; name: string }[]
}

type Props = {
  levels: LevelRow[]
  selectedPeriod: { id: string; name: string } | null
  defaultCapacity: number
  allLevels: { id: string; name: string }[]
  takenNextLevelIds: string[]
}

/** Préférence locale : la liste des niveaux garde le filtre d'une visite à l'autre. */
const FILTER_STORAGE_KEY = 'peaklab.levels.openPeriodOnly'

export function LevelsTable({
  levels,
  selectedPeriod,
  defaultCapacity,
  allLevels,
  takenNextLevelIds,
}: Props) {
  const t = useTranslations('dashboard.pages.levels')
  // Décoché par défaut : le filtre masque justement les niveaux dépourvus de classe sur la
  // période, ceux qui portent le bouton de génération.
  const [openPeriodOnly, setOpenPeriodOnly] = useState(false)

  // Le choix est relu après le premier rendu, jamais pendant : le HTML serveur ignore le
  // stockage local et divergerait du client.
  useEffect(() => {
    setOpenPeriodOnly(window.localStorage.getItem(FILTER_STORAGE_KEY) === '1')
  }, [])

  const toggleOpenPeriodOnly = (checked: boolean) => {
    setOpenPeriodOnly(checked)
    window.localStorage.setItem(FILTER_STORAGE_KEY, checked ? '1' : '0')
  }

  // Sans période sélectionnée, aucune classe n'est chargée et la case à cocher n'est pas
  // rendue : appliquer la préférence mémorisée viderait la table sans moyen de revenir.
  const rows =
    selectedPeriod && openPeriodOnly
      ? levels.filter((level) => level.currentClasses.length > 0)
      : levels
  const hiddenCount = levels.length - rows.length

  const columns: Column<LevelRow>[] = [
    {
      key: 'name',
      header: t('name'),
    },
    {
      key: 'nextLevel',
      header: t('nextLevel'),
      className: 'text-graphite',
      render: (level) => level.nextLevelName ?? <span className="text-graphite-800">&mdash;</span>,
    },
    {
      key: 'classes',
      header: t('classes'),
      className: 'text-graphite',
      // Le total porte tout l'historique du niveau ; seules les classes de la période
      // sélectionnée sont accessibles d'un clic, les autres n'ont plus d'usage courant.
      render: (level) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{level.classCount}</span>
          {level.currentClasses.map((classPeriod) => (
            <Link
              key={classPeriod.id}
              href={`/dashboard/classes/${classPeriod.id}`}
              className="rounded bg-alabaster-800 px-2 py-0.5 text-xs font-medium text-primary hover:text-primary-hover hover:underline"
            >
              {classPeriod.name}
            </Link>
          ))}
          {selectedPeriod && level.currentClasses.length === 0 && (
            <GenerateClassDialog
              levelId={level.id}
              levelName={level.name}
              periodId={selectedPeriod.id}
              periodName={selectedPeriod.name}
              defaultCapacity={defaultCapacity}
            />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (level) => (
        <LevelActionsMenu
          level={level}
          allLevels={allLevels}
          takenNextLevelIds={takenNextLevelIds}
        />
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {selectedPeriod && (
        <label className="flex w-fit items-center gap-2 text-sm text-graphite-600">
          <input
            type="checkbox"
            checked={openPeriodOnly}
            onChange={(event) => toggleOpenPeriodOnly(event.target.checked)}
            className="h-4 w-4 rounded border-alabaster-700 text-primary"
          />
          {t('openPeriodOnly', { period: selectedPeriod.name })}
          {openPeriodOnly && hiddenCount > 0 && (
            <span className="text-graphite-700">{t('hiddenLevels', { count: hiddenCount })}</span>
          )}
        </label>
      )}

      <Card className="rounded border border-alabaster-700">
        <DataTable
          data={rows}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage={t('noLevels')}
        />
      </Card>
    </div>
  )
}
