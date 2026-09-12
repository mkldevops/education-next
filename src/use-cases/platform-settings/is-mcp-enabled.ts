import { MCP_ENABLED_SETTING, readsAsOptedIn } from '@/domain/platform-settings'
import { getPlatformSetting } from './get-platform-setting'

/**
 * État du serveur MCP pour toute l'instance, **désactivé par défaut**.
 *
 * Inversion volontaire par rapport aux autres drapeaux : ceux-ci gardent une fonction
 * déjà en place, celui-ci ouvre une surface d'écriture machine qui n'existait pas.
 */
export async function isMcpEnabled(
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  const setting = await getSetting({ name: MCP_ENABLED_SETTING })

  return readsAsOptedIn(typeof setting === 'string' ? null : setting.value)
}
