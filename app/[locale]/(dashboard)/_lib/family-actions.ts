'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { personGateway } from '@/gateways/person-gateway'
import { addPersonToFamily } from '@/use-cases/families/add-person-to-family'
import { createFullFamily } from '@/use-cases/families/create-full-family'
import type { createFullFamilySchema } from '@/use-cases/families/create-full-family-schema'
import { deactivateFamily } from '@/use-cases/families/deactivate-family'
import { deleteFamily } from '@/use-cases/families/delete-family'
import { linkUserToFamily } from '@/use-cases/families/link-user-to-family'
import type {
  addPersonToFamilySchema,
  linkUserToFamilySchema,
  updateFamilyPersonSchema,
  updateFamilySchema,
} from '@/use-cases/families/schemas'
import { phoneNumberSchema } from '@/use-cases/families/schemas'
import { updateFamily } from '@/use-cases/families/update-family'
import { updateFamilyPerson } from '@/use-cases/families/update-family-person'
import { requireSchoolAdmin, requireSchoolStaff } from './auth-helper'

type CreateFamilyInput = z.input<typeof createFullFamilySchema>
type UpdateFamilyInput = z.infer<typeof updateFamilySchema>
type AddPersonToFamilyInput = z.infer<typeof addPersonToFamilySchema>
type LinkUserToFamilyInput = z.infer<typeof linkUserToFamilySchema>
type UpdateFamilyPersonInput = z.infer<typeof updateFamilyPersonSchema>

/**
 * Parcours « Créer une famille » : responsable, enfants et inscriptions en une transaction.
 * Sans enfant ni responsable, c'est l'ancien formulaire « nom seul ».
 */
export async function createFamilyAction(data: Omit<CreateFamilyInput, 'schoolId'>) {
  const { schoolId, userId, isAdmin } = await requireSchoolStaff()
  const result = await createFullFamily({
    ...data,
    schoolId,
    createdById: userId,
    deferPricing: !isAdmin,
  })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  if (result.studentIds.length > 0) {
    revalidatePath('/dashboard/students')
    revalidatePath('/dashboard/enrollments')
    revalidatePath('/dashboard')
  }
  return result
}

export async function updateFamilyAction(
  id: string,
  data: Omit<UpdateFamilyInput, 'schoolId' | 'id'>
) {
  const { schoolId } = await requireSchoolStaff()
  const result = await updateFamily({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  return result
}

export async function deactivateFamilyAction(id: string) {
  const { schoolId } = await requireSchoolStaff()
  const result = await deactivateFamily({ schoolId, id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/families')
  return 'OK' as const
}

/**
 * Suppression définitive. Elle touche les élèves, les inscriptions et les règlements,
 * donc toutes les listes construites sur eux sont réinvalidées, pas seulement celle
 * des familles.
 */
export async function deleteFamilyAction(id: string, confirmation: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deleteFamily({ schoolId, id, confirmation })
  if (result !== 'OK') return result
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/families')
  revalidatePath('/dashboard/students', 'layout')
  revalidatePath('/dashboard/enrollments')
  revalidatePath('/dashboard/payments')
  return 'OK' as const
}

export async function addPersonToFamilyAction(data: Omit<AddPersonToFamilyInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolStaff()
  const result = await addPersonToFamily({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}

export async function updateFamilyPersonAction(data: Omit<UpdateFamilyPersonInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolStaff()
  const result = await updateFamilyPerson({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  revalidatePath('/dashboard/students', 'layout')
  return result
}

export async function linkUserToFamilyAction(data: Omit<LinkUserToFamilyInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await linkUserToFamily({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/families')
  return 'OK' as const
}

export async function addPhoneAction(
  personId: string,
  data: { phoneNumber: string; channels: string[] }
) {
  const { schoolId } = await requireSchoolStaff()
  const parsed = phoneNumberSchema.safeParse(data)
  if (!parsed.success) return 'validationError' as const
  const phone = await personGateway.addPhone(schoolId, personId, {
    phoneNumber: parsed.data.phoneNumber,
    channels: parsed.data.channels,
  })
  revalidatePath('/dashboard/families')
  return phone
}
