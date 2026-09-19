import { DAY_MS } from './day'

/** Préfixe littéral de toute clé MCP : il rend la fuite reconnaissable dans un log ou un dépôt. */
export const MCP_KEY_PREFIX = 'edu_mcp_'

/** 32 octets en base64url tiennent sur 43 caractères sans remplissage. */
export const MCP_KEY_SECRET_BYTES = 32

const MCP_KEY_PATTERN = /^edu_mcp_[A-Za-z0-9_-]{43}$/

/** Longueur du fragment stocké en clair, seul repère visuel de la liste de clés. */
const MCP_KEY_PREFIX_LENGTH = 12

/** Durées d'expiration proposées à la création. Une clé sans fin de vie n'en est pas une. */
export const MCP_KEY_LIFETIMES_DAYS = [30, 90, 365] as const

export const MCP_KEY_DEFAULT_LIFETIME_DAYS = 90

/** Nombre de clés vivantes par couple (utilisateur, école). */
export const MCP_KEY_MAX_PER_USER = 5

export function isWellFormedMcpKey(value: string): boolean {
  return MCP_KEY_PATTERN.test(value)
}

export function mcpKeyPrefix(key: string): string {
  return key.slice(0, MCP_KEY_PREFIX_LENGTH)
}

type KeyLifecycle = { revokedAt: Date | null; expiresAt: Date }

/**
 * Une clé révoquée et une clé expirée sont refusées de la même façon : distinguer les
 * deux au porteur lui apprendrait qu'une clé a existé.
 */
export function isKeyUsable(key: KeyLifecycle, now: Date = new Date()): boolean {
  return key.revokedAt === null && key.expiresAt.getTime() > now.getTime()
}

export function expiryFromDays(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * DAY_MS)
}
