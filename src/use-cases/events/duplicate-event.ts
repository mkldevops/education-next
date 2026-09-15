import { z } from 'zod'
import { shiftEventToNextYear } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { createEvent } from './create-event'

const duplicateEventSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
})

type Input = z.infer<typeof duplicateEventSchema>

/**
 * Reconduit un événement à l'année suivante en passant par `createEvent` : drapeau, bornes
 * de dates et refus `'slugTaken'` restent ceux de la création. Le titre est une entrée,
 * pas une copie, parce qu'un titre identique au précédent tomberait précisément sur ce
 * refus — il se corrige dans le formulaire, jamais par un suffixe silencieux.
 *
 * Le double naît `DRAFT` et sans image : l'affiche de l'an dernier porte sa date.
 */
export async function duplicateEvent(
  input: Input,
  gw = eventGateway,
  configGw = configGateway,
  create = createEvent
) {
  const parsed = duplicateEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, title } = parsed.data
  const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const source = await gw.findById(schoolId, id)
  if (!source) return 'notFound' as const

  return create(
    {
      schoolId,
      title,
      summary: source.summary,
      description: source.description,
      category: source.category,
      visibility: source.visibility,
      status: 'DRAFT',
      allDay: source.allDay,
      ...shiftEventToNextYear(source),
      location: source.location,
      announceDaysBefore: source.announceDaysBefore,
    },
    gw,
    configGw
  )
}
