import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { readEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { mcpEventIdSchema } from './schemas'

type Input = z.infer<typeof mcpEventIdSchema>

export async function getEventFromMcp(
  scope: { schoolId: string },
  input: Input,
  readGw = mcpReadGateway,
  configGw = configGateway
) {
  const parsed = mcpEventIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!(await readEventsEnabled(scope.schoolId, configGw))) return 'notConfigured' as const

  const event = await readGw.getEvent(scope.schoolId, parsed.data.id)
  return event ?? ('notFound' as const)
}
