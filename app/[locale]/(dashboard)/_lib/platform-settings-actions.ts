'use server'

import { revalidatePath } from 'next/cache'
import {
  AI_ASSISTANT_ENABLED_SETTING,
  GOOGLE_SIGN_IN_SETTING,
  MCP_ENABLED_SETTING,
  PASSKEY_SIGN_IN_SETTING,
  SCHOOL_SWITCH_SETTING,
} from '@/domain/platform-settings'
import {
  deleteOpenRouterApiKey,
  setOpenRouterApiKey,
} from '@/use-cases/platform-settings/openrouter-api-key'
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

export async function setMcpEnabledAction(enabled: boolean) {
  return writeFlag(MCP_ENABLED_SETTING, enabled)
}

export async function setAiAssistantEnabledAction(enabled: boolean) {
  return writeFlag(AI_ASSISTANT_ENABLED_SETTING, enabled)
}

/**
 * La clé traverse l'action une seule fois, à la saisie, et n'en ressort jamais : le retour
 * est un verdict, la page ne relit qu'un état « configurée / non configurée ».
 */
export async function setOpenRouterApiKeyAction(apiKey: string) {
  await requirePlatformAdmin()

  const result = await setOpenRouterApiKey(apiKey)
  if (result !== 'OK') return result

  revalidatePath('/', 'layout')
  return 'OK' as const
}

export async function deleteOpenRouterApiKeyAction() {
  await requirePlatformAdmin()

  await deleteOpenRouterApiKey()

  revalidatePath('/', 'layout')
  return 'OK' as const
}
