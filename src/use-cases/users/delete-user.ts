import type { z } from 'zod'
import { type Actor, checkDeletion } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { userIdSchema } from './schemas'

type Input = z.infer<typeof userIdSchema>

export async function deleteUser(actor: Actor, input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const relatedRecords = await userGateway.countBlockingRelations(parsed.data.id)
  const check = checkDeletion(actor, target, relatedRecords)
  if (check !== 'OK') return check

  await userGateway.delete(parsed.data.id)
  return 'OK' as const
}
