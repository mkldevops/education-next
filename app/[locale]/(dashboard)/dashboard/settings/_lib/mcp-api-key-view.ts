export type McpApiKeyView = {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

type McpApiKeyRecord = {
  id: string
  name: string
  prefix: string
  lastUsedAt: Date | null
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

export function toMcpApiKeyView(record: McpApiKeyRecord): McpApiKeyView {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}
