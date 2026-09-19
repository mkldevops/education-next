import { cache } from 'react'
import { readsAsEnabled, readsAsOptedIn } from '@/domain/feature-flags'
import { getPlatformSetting } from './get-platform-setting'

/**
 * Mémoïsé pour la durée d'un rendu : plusieurs surfaces consultent le même drapeau dans
 * une seule requête — résolution de contexte, layout, page. Hors rendu — action serveur,
 * test — `cache()` se réduit à un appel direct, donc le verdict suit la base sans mise en
 * cache inter-requêtes.
 */
const readFlag = cache(
  async (
    name: string,
    getSetting: typeof getPlatformSetting,
    verdict: (value: string | null) => boolean
  ): Promise<boolean> => {
    const setting = await getSetting({ name })

    // Le nom est une constante : `validationError` est inatteignable, et `notFound` est
    // le cas nominal d'une installation qui n'a jamais touché au réglage.
    return verdict(typeof setting === 'string' ? null : setting.value)
  }
)

export function readPlatformFlag(
  name: string,
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  return readFlag(name, getSetting, readsAsEnabled)
}

/** Variante qui ne s'ouvre que sur un `true` explicite. */
export function readPlatformOptInFlag(
  name: string,
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  return readFlag(name, getSetting, readsAsOptedIn)
}
