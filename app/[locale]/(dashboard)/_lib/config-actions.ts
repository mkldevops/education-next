'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getConfig } from '@/use-cases/config/get-config'
import type { getConfigSchema, setConfigSchema } from '@/use-cases/config/schemas'
import { setConfig } from '@/use-cases/config/set-config'
import { requireSchoolAdmin } from './auth-helper'

type SetConfigInput = z.infer<typeof setConfigSchema>
type GetConfigInput = z.infer<typeof getConfigSchema>

export async function setConfigAction(data: Omit<SetConfigInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setConfig({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/config')
  return result
}

export async function getConfigAction(data: Omit<GetConfigInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await getConfig({ ...data, schoolId })
  if (typeof result === 'string') return result
  return result
}
