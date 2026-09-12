import { MCP_ENABLED_SETTING } from '@/domain/platform-settings'
import type { getPlatformSetting } from './get-platform-setting'
import { readPlatformOptInFlag } from './read-platform-flag'

/**
 * État du serveur MCP pour toute l'instance, **désactivé par défaut**.
 *
 * Inversion volontaire par rapport aux autres drapeaux : ceux-ci gardent une fonction
 * déjà en place, celui-ci ouvre une surface d'écriture machine qui n'existait pas.
 */
export function isMcpEnabled(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return readPlatformOptInFlag(MCP_ENABLED_SETTING, getSetting)
}
