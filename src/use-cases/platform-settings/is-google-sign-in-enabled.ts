import { GOOGLE_SIGN_IN_SETTING } from '@/domain/platform-settings'
import type { getPlatformSetting } from './get-platform-setting'
import { readPlatformFlag } from './read-platform-flag'

/**
 * État de la connexion Google pour toute l'instance. Le drapeau ne remplace pas la
 * présence des identifiants OAuth : `isGoogleConfigured` reste la condition d'affichage.
 */
export function isGoogleSignInEnabled(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return readPlatformFlag(GOOGLE_SIGN_IN_SETTING, getSetting)
}
