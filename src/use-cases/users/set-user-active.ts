import type { z } from 'zod'
import { type Actor, checkDeactivation, checkReactivation } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { userIdSchema } from './schemas'

type Input = z.infer<typeof userIdSchema>

export async function deactivateUser(actor: Actor, input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const activeSuperAdmins = await userGateway.countActiveSuperAdmins()
  const check = checkDeactivation(actor, target, activeSuperAdmins)
  if (check !== 'OK') return check

  await userGateway.setActive(parsed.data.id, false)
  return 'OK' as const
}

export async function reactivateUser(actor: Actor, input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const check = checkReactivation(actor, target)
  if (check !== 'OK') return check

  await userGateway.setActive(parsed.data.id, true)
  return 'OK' as const
}
