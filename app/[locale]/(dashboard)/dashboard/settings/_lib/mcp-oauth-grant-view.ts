export type McpOAuthGrantView = {
  id: string
  clientName: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

type McpOAuthGrantRecord = {
  id: string
  clientName: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export function toMcpOAuthGrantView(record: McpOAuthGrantRecord): McpOAuthGrantView {
  return {
    id: record.id,
    clientName: record.clientName,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}
