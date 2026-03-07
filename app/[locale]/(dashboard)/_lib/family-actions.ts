'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { personGateway } from '@/gateways/person-gateway'
import { addPersonToFamily } from '@/use-cases/families/add-person-to-family'
import { createFamily } from '@/use-cases/families/create-family'
import { deactivateFamily } from '@/use-cases/families/deactivate-family'
import { linkUserToFamily } from '@/use-cases/families/link-user-to-family'
import type {
  addPersonToFamilySchema,
  createFamilySchema,
  linkUserToFamilySchema,
  updateFamilySchema,
} from '@/use-cases/families/schemas'
import { phoneNumberSchema } from '@/use-cases/families/schemas'
import { updateFamily } from '@/use-cases/families/update-family'
import { requireAdmin } from './auth-helper'

type CreateFamilyInput = z.infer<typeof createFamilySchema>
type UpdateFamilyInput = z.infer<typeof updateFamilySchema>
type AddPersonToFamilyInput = z.infer<typeof addPersonToFamilySchema>
type LinkUserToFamilyInput = z.infer<typeof linkUserToFamilySchema>

export async function createFamilyAction(
  data: Omit<CreateFamilyInput, 'createdById'> & { name: string }
) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createFamily({ ...data, createdById: user.id })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  return result
}

export async function updateFamilyAction(id: string, data: Omit<UpdateFamilyInput, 'id'>) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await updateFamily({ id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  return result
}

export async function deactivateFamilyAction(id: string) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await deactivateFamily({ id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/families')
  return 'OK' as const
}

export async function addPersonToFamilyAction(data: AddPersonToFamilyInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await addPersonToFamily(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/families')
  return result
}

export async function linkUserToFamilyAction(data: LinkUserToFamilyInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await linkUserToFamily(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/families')
  return 'OK' as const
}

export async function addPhoneAction(
  personId: string,
  data: { phoneNumber: string; channels: string[] }
) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const parsed = phoneNumberSchema.safeParse(data)
  if (!parsed.success) return 'validationError' as const
  const phone = await personGateway.addPhone(personId, {
    phoneNumber: parsed.data.phoneNumber,
    channels: parsed.data.channels,
  })
  revalidatePath('/dashboard/families')
  return phone
}
