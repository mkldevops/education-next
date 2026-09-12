import type { z } from 'zod'
import { type Actor, checkDeletion } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { countUserDeletionBlockers } from './count-deletion-blockers'
import { userIdSchema } from './schemas'

type Input = z.infer<typeof userIdSchema>

export async function deleteUser(actor: Actor, input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const check = checkDeletion(actor, target, await countUserDeletionBlockers(parsed.data.id))
  if (check !== 'OK') return check

  await userGateway.delete(parsed.data.id)
  return 'OK' as const
}
