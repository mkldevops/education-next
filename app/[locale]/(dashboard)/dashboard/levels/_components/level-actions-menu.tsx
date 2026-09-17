'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EditLevelDialog } from './edit-level-dialog'

type Props = {
  level: { id: string; name: string; nextLevelId: string | null; classCount: number }
  allLevels: { id: string; name: string }[]
  takenNextLevelIds: string[]
}

/**
 * Actions secondaires d'un niveau, repliées derrière un seul bouton.
 *
 * Le panneau est masqué en CSS plutôt que démonté : les dialogues vivent à l'intérieur, et les
 * retirer de l'arbre à la fermeture du menu fermerait aussi le dialogue qu'on vient d'ouvrir.
 * Un dialogue ouvert masque le panneau dès qu'on clique dedans (portalé hors du conteneur, donc
 * hors du clic « extérieur » du menu) : son déclencheur devient alors invisible pendant que le
 * dialogue reste ouvert. `restoreFocusRef` donne à chaque dialogue une cible de repli — le
 * bouton `⋯`, seul ancrage qui reste visible — pour quand il referme et que son propre
 * déclencheur n'est plus focalisable.
 */
export function LevelActionsMenu({ level, allLevels, takenNextLevelIds }: Props) {
  const t = useTranslations('dashboard.pages.levels')
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()

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
        <EditLevelDialog
          level={{ id: level.id, name: level.name }}
          currentNextLevelId={level.nextLevelId}
          allLevels={allLevels}
          takenNextLevelIds={takenNextLevelIds}
          classPeriodCount={level.classCount}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
      </div>
    </div>
  )
}
