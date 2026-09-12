import { z } from 'zod'
import { MCP_KEY_LIFETIMES_DAYS } from '@/domain/mcp-key'

export const createMcpApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  lifetimeDays: z.literal(MCP_KEY_LIFETIMES_DAYS),
})
