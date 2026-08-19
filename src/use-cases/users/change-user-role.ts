import type { z } from 'zod'
import { type Actor, canAssignRole, checkRoleChange } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { changeUserRoleSchema } from './schemas'

type Input = z.infer<typeof changeUserRoleSchema>

export async function changeUserRole(actor: Actor, input: Input) {
  const parsed = changeUserRoleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  if (!canAssignRole(actor.role, parsed.data.role)) return 'unauthorized' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const
  if (target.role === parsed.data.role) return 'OK' as const

  const activeSuperAdmins = await userGateway.countActiveSuperAdmins()
  const check = checkRoleChange(actor, target, parsed.data.role, activeSuperAdmins)
  if (check !== 'OK') return check

  await userGateway.changeRole(parsed.data.id, parsed.data.role)
  return 'OK' as const
}
