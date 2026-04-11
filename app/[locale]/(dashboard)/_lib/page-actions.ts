'use server'

import { revalidatePath } from 'next/cache'
import { createPage } from '@/use-cases/pages/create-page'
import { deletePage } from '@/use-cases/pages/delete-page'
import type { CreatePageInput, UpdatePageInput } from '@/use-cases/pages/schemas'
import { updatePage } from '@/use-cases/pages/update-page'
import { requireAdmin } from './auth-helper'

export async function createPageAction(data: CreatePageInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createPage(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/pages')
  revalidatePath('/')
  return result
}

export async function updatePageAction(data: UpdatePageInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await updatePage(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/pages')
  revalidatePath('/')
  revalidatePath(`/${data.slug}`)
  return result
}

export async function deletePageAction(id: string) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await deletePage({ id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/pages')
  revalidatePath('/')
  return result
}
