import { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { readEventsEnabled } from './is-events-enabled'

// Pas dans `schemas.ts` : le Contract n'y liste que create/update/addImage/removeImage.
// Même motif que `deactivate-family.ts`, dont ce fichier est calqué.
const archiveEventSchema = z.object({ schoolId: z.string().min(1), id: z.uuid() })

type Input = z.infer<typeof archiveEventSchema>

export async function archiveEvent(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = archiveEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id } = parsed.data
  if (!(await readEventsEnabled(schoolId, configGw))) return 'notConfigured' as const

  const event = await gw.findById(schoolId, id)
  if (!event) return 'notFound' as const

  return gw.archive(schoolId, id)
}
