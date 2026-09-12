import type { z } from 'zod'
import { type Actor, checkDeletion } from '@/domain/user'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { userGateway } from '@/gateways/user-gateway'
import { countRowsBlockingUserDeletion } from '@/lib/db-unscoped'
import { userIdSchema } from './schemas'

type Input = z.infer<typeof userIdSchema>

export async function deleteUser(actor: Actor, input: Input) {
  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  // Les clés machine se comptent par leur propre frontière : `McpApiKey` est hors garde
  // tenant et sans suppression douce, donc le client ordinaire en voit déjà toutes les
  // lignes, et `db-unscoped` n'a pas à gagner une exception de plus.
  const [platformRows, machineKeys] = await Promise.all([
    countRowsBlockingUserDeletion(parsed.data.id),
    mcpApiKeyGateway.countForUser(parsed.data.id),
  ])

  const check = checkDeletion(actor, target, platformRows + machineKeys)
  if (check !== 'OK') return check

  await userGateway.delete(parsed.data.id)
  return 'OK' as const
}
