import { cache } from 'react'
import { readsAsEnabled, SCHOOL_SWITCH_SETTING } from '@/domain/platform-settings'
import { getPlatformSetting } from './get-platform-setting'

/**
 * Mémoïsé pour la durée d'un rendu : la résolution du contexte le consulte désormais à
 * chaque requête d'un membre ordinaire, et le layout le redemande pour l'affichage.
 * Hors rendu — action serveur, test — `cache()` se réduit à un appel direct, donc le
 * verdict suit la base sans mise en cache inter-requêtes.
 */
const readFlag = cache(async (getSetting: typeof getPlatformSetting): Promise<boolean> => {
  const setting = await getSetting({ name: SCHOOL_SWITCH_SETTING })

  // Le nom est une constante : `validationError` est inatteignable, et `notFound` est
  // le cas nominal d'une installation qui n'a jamais touché au réglage.
  return readsAsEnabled(typeof setting === 'string' ? null : setting.value)
})

/**
 * État de la bascule d'école pour un membre ordinaire. Un super-admin n'est jamais
 * soumis au drapeau : ses appelants tranchent avant d'arriver ici.
 */
export function isSchoolSwitchEnabled(
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  return readFlag(getSetting)
}
