'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { changeMealSchedule } from '@/use-cases/meals/change-meal-schedule'
import { recordMealOpening } from '@/use-cases/meals/record-meal-opening'
import { removeMealPrice } from '@/use-cases/meals/remove-meal-price'
import type {
  changeMealScheduleSchema,
  recordMealOpeningSchema,
  setMealPriceSchema,
  setMealServiceSettingSchema,
  stopMealSchema,
  subscribeMealSchema,
} from '@/use-cases/meals/schemas'
import { setMealPrice } from '@/use-cases/meals/set-meal-price'
import { setMealServiceSetting } from '@/use-cases/meals/set-meal-service-setting'
import { stopMeal } from '@/use-cases/meals/stop-meal'
import { subscribeMeal } from '@/use-cases/meals/subscribe-meal'
import { requireSchoolAdmin } from './auth-helper'

type SetMealServiceSettingInput = z.infer<typeof setMealServiceSettingSchema>
type SetMealPriceInput = z.infer<typeof setMealPriceSchema>
type SubscribeMealInput = z.infer<typeof subscribeMealSchema>
type ChangeMealScheduleInput = z.infer<typeof changeMealScheduleSchema>
type StopMealInput = z.infer<typeof stopMealSchema>
type RecordMealOpeningInput = z.infer<typeof recordMealOpeningSchema>

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

const studentPath = (studentId: string) => `/dashboard/students/${studentId}`

export async function subscribeMealAction(data: Omit<SubscribeMealInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await subscribeMeal({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath(studentPath(data.studentId))
  return 'OK' as const
}

export async function changeMealScheduleAction(data: Omit<ChangeMealScheduleInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await changeMealSchedule({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath(studentPath(data.studentId))
  return 'OK' as const
}

export async function stopMealAction(data: Omit<StopMealInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await stopMeal({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath(studentPath(data.studentId))
  return 'OK' as const
}

export async function recordMealOpeningAction(
  data: Omit<RecordMealOpeningInput, 'schoolId' | 'recordedById'>
) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await recordMealOpening({ ...data, schoolId, recordedById: userId })
  if (result !== 'OK') return result
  revalidatePath(studentPath(data.studentId))
  return 'OK' as const
}
