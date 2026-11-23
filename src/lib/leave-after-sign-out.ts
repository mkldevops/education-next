import { localizedHref } from '@/i18n/localized-href'

/**
 * Après une déconnexion, navigation complète plutôt que routeur client : le cache du routeur
 * garde les pages du compte précédent, qu'un bouton Retour réafficherait dans le même onglet.
 */
export function leaveAfterSignOut(locale: string) {
  window.location.replace(localizedHref(locale, '/'))
}
