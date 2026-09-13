'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { EditLevelDialog } from './edit-level-dialog'
import { GenerateClassDialog } from './generate-class-dialog'

type Props = {
  level: { id: string; name: string; nextLevelId: string | null; classCount: number }
  /** Période sélectionnée, absente quand le niveau y a déjà une classe. */
  generateFor: { id: string; name: string } | null
  defaultCapacity: number
  allLevels: { id: string; name: string }[]
  takenNextLevelIds: string[]
}

/**
 * Actions secondaires d'un niveau, repliées derrière un seul bouton.
 *
 * Le panneau est masqué en CSS plutôt que démonté : les dialogues vivent à l'intérieur, et les
 * retirer de l'arbre à la fermeture du menu fermerait aussi le dialogue qu'on vient d'ouvrir.
 */
export function LevelActionsMenu({
  level,
  generateFor,
  defaultCapacity,
  allLevels,
  takenNextLevelIds,
}: Props) {
  const t = useTranslations('dashboard.pages.levels')
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()

  // Le panneau se masque dès le premier clic dans un dialogue qu'il contient. `DialogContent`
  // rendrait alors le focus à un bouton devenu `display: none`, un no-op qui renvoie le focus
  // sur `<body>` : on le ramène sur le déclencheur, seul ancrage resté visible.
  useEffect(() => {
    if (open) return
    if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus()
  }, [open, menuRef, triggerRef])

  return (
    <div className="relative flex justify-end" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-label={t('actions')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded p-1 text-graphite-600 hover:bg-alabaster-800 hover:text-graphite"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <div
        ref={menuRef}
        role="menu"
        className={`absolute right-0 top-full z-40 mt-1 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${
          open ? '' : 'hidden'
        }`}
      >
        {generateFor && (
          <GenerateClassDialog
            levelId={level.id}
            levelName={level.name}
            periodId={generateFor.id}
            periodName={generateFor.name}
            defaultCapacity={defaultCapacity}
            triggerRole="menuitem"
          />
        )}
        <EditLevelDialog
          level={{ id: level.id, name: level.name }}
          currentNextLevelId={level.nextLevelId}
          allLevels={allLevels}
          takenNextLevelIds={takenNextLevelIds}
          classPeriodCount={level.classCount}
          triggerRole="menuitem"
        />
      </div>
    </div>
  )
}
