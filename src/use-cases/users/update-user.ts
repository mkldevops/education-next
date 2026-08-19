import type { z } from 'zod'
import { userGateway } from '@/gateways/user-gateway'
import { updateUserSchema } from './schemas'

type Input = z.infer<typeof updateUserSchema>

export async function updateUser(input: Input) {
  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  if (parsed.data.email && parsed.data.email !== target.email) {
    const existing = await userGateway.findByEmail(parsed.data.email)
    if (existing) return 'emailAlreadyUsed' as const
  }

  return userGateway.update(parsed.data.id, {
    name: parsed.data.name,
    email: parsed.data.email,
    emailVerified: parsed.data.emailVerified,
  })
}
