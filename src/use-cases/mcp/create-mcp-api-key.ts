import { expiryFromDays, MCP_KEY_MAX_PER_USER, mcpKeyPrefix } from '@/domain/mcp-key'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { generateMcpKey, hashMcpKey } from '@/lib/mcp-key-crypto'
import { createMcpApiKeySchema } from './schemas'

/**
 * `lifetimeDays` arrive en `number` : l'appelant est une action ouverte au client, donc
 * la restriction aux durées proposées appartient au `safeParse`, pas au type.
 */
type Input = { name: string; lifetimeDays: number; userId: string; schoolId: string }

/**
 * La clé en clair n'est rendue qu'ici, une seule fois : la base n'en garde que le
 * hachage, donc elle est irrécupérable ensuite.
 */
type KeyGateway = Pick<typeof mcpApiKeyGateway, 'createWithinLimit'>

export async function createMcpApiKey(input: Input, keyGw: KeyGateway = mcpApiKeyGateway) {
  const parsed = createMcpApiKeySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const now = new Date()

  // La clé est engendrée avant le verdict : son empreinte et son préfixe font partie de
  // la ligne insérée, et c'est cette insertion qui porte le plafond. Une clé refusée
  // n'aura existé qu'en mémoire.
  const key = generateMcpKey()
  const record = await keyGw.createWithinLimit(
    {
      schoolId: input.schoolId,
      userId: input.userId,
      name: parsed.data.name,
      prefix: mcpKeyPrefix(key),
      keyHash: hashMcpKey(key),
      expiresAt: expiryFromDays(parsed.data.lifetimeDays, now),
    },
    { now, maxLive: MCP_KEY_MAX_PER_USER }
  )
  if (record === 'tooManyKeys') return 'tooManyKeys' as const

  return { key, record }
}
