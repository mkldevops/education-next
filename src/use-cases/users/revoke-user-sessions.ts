import type { z } from 'zod'
import { userGateway } from '@/gateways/user-gateway'
import { userIdSchema } from './schemas'

type Input = z.infer<typeof userIdSchema>

export async function revokeUserSessions(input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const { count } = await userGateway.revokeSessions(parsed.data.id)
  return { revoked: count }
}
