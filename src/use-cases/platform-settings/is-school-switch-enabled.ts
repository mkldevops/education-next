import { SCHOOL_SWITCH_SETTING } from '@/domain/platform-settings'
import type { getPlatformSetting } from './get-platform-setting'
import { readPlatformFlag } from './read-platform-flag'

/**
 * État de la bascule d'école pour un membre ordinaire. Un super-admin n'est jamais
 * soumis au drapeau : ses appelants tranchent avant d'arriver ici.
 */
export function isSchoolSwitchEnabled(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return readPlatformFlag(SCHOOL_SWITCH_SETTING, getSetting)
}
