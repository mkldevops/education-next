'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getConfig } from '@/use-cases/config/get-config'
import type {
  getConfigSchema,
  setConfigSchema,
  setThemeColorsSchema,
} from '@/use-cases/config/schemas'
import { setConfig } from '@/use-cases/config/set-config'
import { setThemeColors } from '@/use-cases/config/set-theme-colors'
import { requireSchoolAdmin } from './auth-helper'

type SetConfigInput = z.infer<typeof setConfigSchema>
type GetConfigInput = z.infer<typeof getConfigSchema>
type SetThemeColorsInput = z.infer<typeof setThemeColorsSchema>

/**
 * Seule écriture d'un réglage d'école, quel que soit le réglage : la liste fermée de
 * `/dashboard/config` la rend suffisante. La revalidation porte sur tout le layout et pas
 * seulement la page — la marque, le thème et les drapeaux de navigation (`payments_enabled`,
 * `events_enabled`) changent la forme de la barre latérale et du tableau de bord, donc les
 * laisser en cache afficherait un état que l'administrateur vient de contredire.
 */
export async function setConfigAction(data: Omit<SetConfigInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setConfig({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/', 'layout')
  return result
}

export async function getConfigAction(data: Omit<GetConfigInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  return getConfig({ ...data, schoolId })
}

/**
 * Le nuancier de `/dashboard/config` enregistre ses quatre couleurs d'un bloc : quatre appels
 * à `setConfigAction` laisseraient un thème mélangé si l'un d'eux échouait.
 */
export async function setThemeColorsAction(data: Omit<SetThemeColorsInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setThemeColors({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/', 'layout')
  return result
}
