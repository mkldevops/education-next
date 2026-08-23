import type { z } from 'zod'
import { type Actor, checkPlatformLevelChange } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { changePlatformLevelSchema } from './schemas'

type Input = z.infer<typeof changePlatformLevelSchema>

export async function changePlatformLevel(actor: Actor, input: Input) {
  const parsed = changePlatformLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const
  if (target.isSuperAdmin === parsed.data.isSuperAdmin) return 'OK' as const

  const activeSuperAdmins = await userGateway.countActiveSuperAdmins()
  const check = checkPlatformLevelChange(actor, target, parsed.data.isSuperAdmin, activeSuperAdmins)
  if (check !== 'OK') return check

  await userGateway.setPlatformLevel(parsed.data.id, parsed.data.isSuperAdmin)
  return 'OK' as const
}
