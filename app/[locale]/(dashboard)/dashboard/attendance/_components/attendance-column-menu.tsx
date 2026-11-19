'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Menu d'une colonne de la grille. Le contenu reste monté quand le menu se ferme : la confirmation
 * d'annulation qu'il ouvre doit survivre à la fermeture du menu.
 */
export function AttendanceColumnMenu({ label, children }: { label: string; children: ReactNode }) {
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()
  return (
    <div className="relative inline-block print:hidden" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded text-graphite-600 opacity-0 group-hover/column:opacity-100 hover:bg-alabaster-800 focus-visible:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      <div
        ref={menuRef}
        role="menu"
        className={`absolute top-full left-1/2 z-40 mt-1 w-56 -translate-x-1/2 rounded border border-alabaster-700 bg-white p-2 text-left font-normal shadow-lg ${open ? '' : 'hidden'}`}
      >
        {children}
      </div>
    </div>
  )
}
