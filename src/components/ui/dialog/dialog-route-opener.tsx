'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { useDialog } from './dialog'

export interface DialogRouteOpenerProps {
  open: boolean
  /**
   * Chemin sans préfixe de locale (`/dashboard/families/<id>`) qui remplace l'URL `?action=` une
   * fois le dialogue ouvert. Le routeur next-intl y ajoute la locale courante.
   */
  cleanUrl?: string
}

/**
 * Ouvre le dialogue quand un lien profond (`?action=…`) le demande, puis nettoie l'URL.
 *
 * Le nettoyage passe par le routeur next-intl et non par `history.replaceState` : il conserve le
 * préfixe de locale et redemande le rendu serveur, si bien que `open` repasse à `false`. Sans ce
 * retour à `false`, un second clic vers la même URL `?action=` laisserait `open` à `true` sans
 * transition, et l'effet ne rouvrirait jamais le dialogue.
 */
export function DialogRouteOpener({ open, cleanUrl }: DialogRouteOpenerProps) {
  const { setOpen } = useDialog()
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    if (!open) return
    setOpen(true)
    if (cleanUrl) routerRef.current.replace(cleanUrl, { scroll: false })
  }, [open, cleanUrl, setOpen])

  return null
}
