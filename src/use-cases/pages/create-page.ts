import { pageGateway } from '@/gateways/page-gateway'
import type { CreatePageInput } from './schemas'
import { createPageSchema } from './schemas'

export type CreatePageFailure = 'validationError' | 'slugAlreadyExists' | 'saveFailed'

export async function createPage(
  input: CreatePageInput,
  gateway = pageGateway
): Promise<CreatePageFailure | 'OK'> {
  const parsed = createPageSchema.safeParse(input)
  if (!parsed.success) return 'validationError'

  const slugExists = await gateway.existsBySlug(parsed.data.slug)
  if (slugExists) return 'slugAlreadyExists'

  try {
    if (parsed.data.isHome) await gateway.unsetHome()
    await gateway.create(parsed.data)
    return 'OK'
  } catch {
    return 'saveFailed'
  }
}
