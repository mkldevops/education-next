import { PASSKEY_SIGN_IN_SETTING } from '@/domain/platform-settings'
import type { getPlatformSetting } from './get-platform-setting'
import { readPlatformFlag } from './read-platform-flag'

/** État de la connexion par passkey pour toute l'instance, enregistrement compris. */
export function isPasskeySignInEnabled(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return readPlatformFlag(PASSKEY_SIGN_IN_SETTING, getSetting)
}
