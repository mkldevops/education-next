import { createHash, randomBytes } from 'node:crypto'
import { MCP_KEY_PREFIX, MCP_KEY_SECRET_BYTES } from '@/domain/mcp-key'

/**
 * SHA-256 nu, sans dérivation lente et sans `timingSafeEqual`.
 *
 * Le secret fait 256 bits d'entropie tirés au hasard : il n'y a rien à étirer, et une
 * attaque par dictionnaire n'a pas de prise. Le hachage est d'autre part la clé d'un
 * index unique — un bcrypt interdirait le `findUnique` et forcerait un balayage de
 * toute la table. La comparaison est faite par l'index B-tree, pas octet par octet.
 */
export function hashMcpKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

export function generateMcpKey(): string {
  return generateMcpSecret(MCP_KEY_PREFIX)
}

/** Même fabrique pour les codes et jetons OAuth : 256 bits sous un préfixe reconnaissable. */
export function generateMcpSecret(prefix: string): string {
  return prefix + randomBytes(MCP_KEY_SECRET_BYTES).toString('base64url')
}

/** `BASE64URL(SHA256(value))`, la forme du `code_challenge` PKCE. */
export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url')
}
