import { pageGateway } from '@/gateways/page-gateway'
import { deletePageSchema } from './schemas'

type DeletePageFailure = 'validationError' | 'notFound' | 'deleteFailed'

export async function deletePage(
  input: { id: string },
  gateway = pageGateway
): Promise<DeletePageFailure | 'OK'> {
  const parsed = deletePageSchema.safeParse(input)
  if (!parsed.success) return 'validationError'

  const existing = await gateway.getById(parsed.data.id)
  if (!existing) return 'notFound'

  try {
    await gateway.softDelete(parsed.data.id)
    return 'OK'
  } catch {
    return 'deleteFailed'
  }
}
