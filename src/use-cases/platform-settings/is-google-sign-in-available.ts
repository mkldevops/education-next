import { isGoogleConfigured } from '@/lib/social-providers'
import type { getPlatformSetting } from './get-platform-setting'
import { isGoogleSignInEnabled } from './is-google-sign-in-enabled'

/**
 * Google est réellement proposable seulement si l'environnement fournit des identifiants
 * OAuth ET si le drapeau est activé — combine les deux conditions pour les pages qui
 * affichent le bouton, en court-circuitant la lecture du réglage quand l'environnement ne
 * l'est pas.
 */
export function isGoogleSignInAvailable(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return isGoogleConfigured ? isGoogleSignInEnabled(getSetting) : Promise.resolve(false)
}
