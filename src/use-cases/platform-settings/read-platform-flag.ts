import { cache } from 'react'
import { readsAsEnabled } from '@/domain/platform-settings'
import { getPlatformSetting } from './get-platform-setting'

/**
 * Mémoïsé pour la durée d'un rendu : plusieurs surfaces consultent le même drapeau dans
 * une seule requête — résolution de contexte, layout, page. Hors rendu — action serveur,
 * test — `cache()` se réduit à un appel direct, donc le verdict suit la base sans mise en
 * cache inter-requêtes.
 */
const readFlag = cache(
  async (name: string, getSetting: typeof getPlatformSetting): Promise<boolean> => {
    const setting = await getSetting({ name })

    // Le nom est une constante : `validationError` est inatteignable, et `notFound` est
    // le cas nominal d'une installation qui n'a jamais touché au réglage.
    return readsAsEnabled(typeof setting === 'string' ? null : setting.value)
  }
)

export function readPlatformFlag(
  name: string,
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  return readFlag(name, getSetting)
}
