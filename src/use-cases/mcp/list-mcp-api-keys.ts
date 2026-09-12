import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'

export async function listMcpApiKeys(
  userId: string,
  schoolId: string,
  keyGw: Pick<typeof mcpApiKeyGateway, 'listForUser'> = mcpApiKeyGateway
) {
  return keyGw.listForUser(userId, schoolId)
}
