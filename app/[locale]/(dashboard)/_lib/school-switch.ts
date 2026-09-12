import { cache } from 'react'
import { getSchoolContext } from '@/lib/school-context'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'

/**
 * Capacité de bascule de l'appelant courant, hors barre latérale.
 *
 * Le drapeau plateforme ne gouverne que les membres ordinaires : un super-admin garde
 * l'issue de secours des liens profonds vers une autre école. La tête de la barre
 * latérale, elle, suit le drapeau seul (`layout.tsx`) : c'est le retour visible du
 * réglage écrit sur `/dashboard/config`. Mémoïsé pour la durée d'un rendu, comme
 * `getSchoolContext()`.
 *
 * Résolu par les pages, jamais par les composants du prompt : un Server Component
 * asynchrone n'exécute pas ses enfants, donc une lecture placée là échapperait à
 * `__tests__/render-reads.test.tsx`.
 */
export const canSwitchSchool = cache(async (): Promise<boolean> => {
  const context = await getSchoolContext()
  if (!context) return false
  if (context.isSuperAdmin) return true

  return isSchoolSwitchEnabled()
})
