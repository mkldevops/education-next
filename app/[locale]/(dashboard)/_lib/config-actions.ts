'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getConfig } from '@/use-cases/config/get-config'
import type { getConfigSchema, setConfigSchema } from '@/use-cases/config/schemas'
import { setConfig } from '@/use-cases/config/set-config'
import { requireAdmin } from './auth-helper'

type SetConfigInput = z.infer<typeof setConfigSchema>
type GetConfigInput = z.infer<typeof getConfigSchema>

export async function setConfigAction(data: SetConfigInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await setConfig(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/config')
  return result
}

export async function getConfigAction(data: GetConfigInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await getConfig(data)
  if (typeof result === 'string') return result
  return result
}
