import { createHash } from 'node:crypto'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'

/**
 * Sérialisation à clés triées, récursive.
 *
 * `JSON.stringify` conserve l'ordre d'insertion : le même plan reconstruit dans un ordre
 * différent produirait un autre checksum, et le commit serait refusé sans raison. Le tri
 * rend la signature dépendante des valeurs seules.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (value instanceof Date) return JSON.stringify(value.toISOString())

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)

  return `{${entries.join(',')}}`
}

export function draftChecksum(resolved: unknown): string {
  return createHash('sha256')
    .update(canonicalize(resolved), 'utf8')
    .digest('hex')
    .slice(0, MCP_DRAFT_CHECKSUM_LENGTH)
}
