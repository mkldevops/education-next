'use client'

import { useState } from 'react'

/**
 * Ouvrir la page marque tout comme vu, ce qui rafraîchit la route : sans cet instantané pris au
 * premier rendu, les badges « Nouveau » disparaîtraient sous les yeux de l'utilisateur.
 */
export function AnnouncementNewBadge({ isNew, label }: { isNew: boolean; label: string }) {
  const [shown] = useState(isNew)
  if (!shown) return null

  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
    </span>
  )
}
