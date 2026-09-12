import { cache } from 'react'
import { readsAsEnabled, readsAsOptedIn } from '@/domain/platform-settings'
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

/**
 * Frère de `readFlag` pour les drapeaux qui s'ouvrent sur un `true` explicite au lieu de
 * se fermer sur un `false` explicite — mémoïsé de la même façon, réduit à un appel direct
 * hors rendu.
 */
const readOptInFlag = cache(
  async (name: string, getSetting: typeof getPlatformSetting): Promise<boolean> => {
    const setting = await getSetting({ name })

    return readsAsOptedIn(typeof setting === 'string' ? null : setting.value)
  }
)

export function readPlatformOptInFlag(
  name: string,
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  return readOptInFlag(name, getSetting)
}
