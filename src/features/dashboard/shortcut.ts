import { useSyncExternalStore } from 'react'

type NavigatorLike = {
  platform?: string
  userAgent?: string
  userAgentData?: { platform?: string }
}

/** Plateformes Apple : la touche de commande y remplace Ctrl pour les raccourcis. */
export function isApplePlatform(nav: NavigatorLike): boolean {
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const subscribeNoop = () => () => {}

/**
 * Libellé du raccourci de recherche selon le système. Le rendu serveur et l'hydratation affichent
 * la variante Ctrl, puis le client corrige sur Mac : aucun écart d'hydratation possible.
 */
export function useSearchShortcutLabel(): string {
  const apple = useSyncExternalStore(
    subscribeNoop,
    () => isApplePlatform(navigator as NavigatorLike),
    () => false
  )
  return apple ? '⌘K' : 'Ctrl K'
}
