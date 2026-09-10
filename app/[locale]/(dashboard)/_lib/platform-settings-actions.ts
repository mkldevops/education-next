'use server'

import { revalidatePath } from 'next/cache'
import {
  GOOGLE_SIGN_IN_SETTING,
  PASSKEY_SIGN_IN_SETTING,
  SCHOOL_SWITCH_SETTING,
} from '@/domain/platform-settings'
import { setPlatformSetting } from '@/use-cases/platform-settings/set-platform-setting'
import { requirePlatformAdmin } from './auth-helper'

/**
 * Réglage plateforme, donc réservé au super-admin : un `ADMIN` d'école ne gouverne pas
 * une fonction commune à toute l'instance.
 */
async function writeFlag(name: string, enabled: boolean) {
  await requirePlatformAdmin()

  const result = await setPlatformSetting({
    name,
    value: String(enabled),
    valueType: 'BOOLEAN',
  })
  if (typeof result === 'string') return result

  // Le sélecteur d'école et les méthodes de connexion sont rendus hors de la page qui
  // porte l'interrupteur.
  revalidatePath('/', 'layout')
  return 'OK' as const
}

export async function setSchoolSwitchEnabledAction(enabled: boolean) {
  return writeFlag(SCHOOL_SWITCH_SETTING, enabled)
}

export async function setGoogleSignInEnabledAction(enabled: boolean) {
  return writeFlag(GOOGLE_SIGN_IN_SETTING, enabled)
}

export async function setPasskeySignInEnabledAction(enabled: boolean) {
  return writeFlag(PASSKEY_SIGN_IN_SETTING, enabled)
}
