import { pageGateway } from '@/gateways/page-gateway'
import type { UpdatePageInput } from './schemas'
import { updatePageSchema } from './schemas'

export type UpdatePageFailure = 'validationError' | 'notFound' | 'slugAlreadyExists' | 'saveFailed'

export async function updatePage(
  input: UpdatePageInput,
  gateway = pageGateway
): Promise<UpdatePageFailure | 'OK'> {
  const parsed = updatePageSchema.safeParse(input)
  if (!parsed.success) return 'validationError'

  const existing = await gateway.getById(parsed.data.id)
  if (!existing) return 'notFound'

  const slugExists = await gateway.existsBySlug(parsed.data.slug, parsed.data.id)
  if (slugExists) return 'slugAlreadyExists'

  const { id, ...data } = parsed.data

  try {
    if (parsed.data.isHome) await gateway.unsetHome(id)
    await gateway.update(id, data)
    return 'OK'
  } catch {
    return 'saveFailed'
  }
}
