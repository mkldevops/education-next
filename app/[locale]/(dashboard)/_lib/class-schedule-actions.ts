'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import {
  createClassScheduleSlot,
  deleteClassScheduleSlot,
  updateClassScheduleSlot,
} from '@/use-cases/class-schedules/class-schedule-slot'
import type {
  createClassScheduleSlotSchema,
  deleteClassScheduleSlotSchema,
  updateClassScheduleSlotSchema,
} from '@/use-cases/class-schedules/schemas'
import { requireSchoolAdmin } from './auth-helper'

type CreateInput = z.infer<typeof createClassScheduleSlotSchema>
type UpdateInput = z.infer<typeof updateClassScheduleSlotSchema>
type DeleteInput = z.infer<typeof deleteClassScheduleSlotSchema>

function revalidateSchedule() {
  revalidatePath('/dashboard/planning')
  revalidatePath('/', 'layout')
}

export async function createClassScheduleSlotAction(data: Omit<CreateInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createClassScheduleSlot({ ...data, schoolId })
  if (typeof result !== 'string') revalidateSchedule()
  return result
}

export async function updateClassScheduleSlotAction(data: Omit<UpdateInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateClassScheduleSlot({ ...data, schoolId })
  if (typeof result !== 'string') revalidateSchedule()
  return result
}

export async function deleteClassScheduleSlotAction(data: Omit<DeleteInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deleteClassScheduleSlot({ ...data, schoolId })
  if (result === 'OK') revalidateSchedule()
  return result
}
