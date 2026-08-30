'use server'

import { revalidatePath } from 'next/cache'
import { SCHOOL_SWITCH_SETTING } from '@/domain/platform-settings'
import { setPlatformSetting } from '@/use-cases/platform-settings/set-platform-setting'
import { requirePlatformAdmin } from './auth-helper'

/**
 * Réglage plateforme, donc réservé au super-admin : un `ADMIN` d'école ne gouverne pas
 * une fonction commune à toute l'instance.
 */
export async function setSchoolSwitchEnabledAction(enabled: boolean) {
  await requirePlatformAdmin()

  const result = await setPlatformSetting({
    name: SCHOOL_SWITCH_SETTING,
    value: String(enabled),
    valueType: 'BOOLEAN',
  })
  if (typeof result === 'string') return result

  // Le sélecteur d'école est rendu par le layout du dashboard, pas par cette page.
  revalidatePath('/', 'layout')
  return 'OK' as const
}
