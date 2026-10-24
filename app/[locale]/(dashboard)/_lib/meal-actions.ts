'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { removeMealPrice } from '@/use-cases/meals/remove-meal-price'
import type { setMealPriceSchema, setMealServiceSettingSchema } from '@/use-cases/meals/schemas'
import { setMealPrice } from '@/use-cases/meals/set-meal-price'
import { setMealServiceSetting } from '@/use-cases/meals/set-meal-service-setting'
import { requireSchoolAdmin } from './auth-helper'

type SetMealServiceSettingInput = z.infer<typeof setMealServiceSettingSchema>
type SetMealPriceInput = z.infer<typeof setMealPriceSchema>

export async function setMealServiceSettingAction(
  data: Omit<SetMealServiceSettingInput, 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setMealServiceSetting({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/meals')
  return 'OK' as const
}

export async function setMealPriceAction(data: Omit<SetMealPriceInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setMealPrice({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/meals')
  return 'OK' as const
}

export async function removeMealPriceAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await removeMealPrice({ id, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/meals')
  return 'OK' as const
}
