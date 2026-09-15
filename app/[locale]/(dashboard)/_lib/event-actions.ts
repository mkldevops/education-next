'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { addEventImage } from '@/use-cases/events/add-event-image'
import { archiveEvent } from '@/use-cases/events/archive-event'
import { createEvent } from '@/use-cases/events/create-event'
import { duplicateEvent } from '@/use-cases/events/duplicate-event'
import { removeEventImage } from '@/use-cases/events/remove-event-image'
import type { createEventSchema, updateEventSchema } from '@/use-cases/events/schemas'
import { setEventCover } from '@/use-cases/events/set-event-cover'
import { updateEvent } from '@/use-cases/events/update-event'
import { uploadEventImage } from '@/use-cases/media/upload-event-image'
import { requireSchoolAdmin } from './auth-helper'

type CreateEventInput = z.infer<typeof createEventSchema>
type UpdateEventInput = z.infer<typeof updateEventSchema>

export async function createEventAction(data: Omit<CreateEventInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createEvent({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}

export async function updateEventAction(
  id: string,
  data: Omit<UpdateEventInput, 'id' | 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateEvent({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}

export async function duplicateEventAction(id: string, title: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await duplicateEvent({ schoolId, id, title })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}

export async function archiveEventAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await archiveEvent({ schoolId, id })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}

/**
 * Upload (stockage) puis attache (`addEventImage`) en un seul appel : il n'existe pas
 * d'action séparée pour la seconde étape. Les échecs internes de l'upload
 * (`unsupportedType|fileTooLarge|emptyFile`) sont aplatis en discriminants plats, comme
 * ceux du use-case d'attache, pour rester sur la même convention
 * `typeof result === 'string'` que les autres actions.
 *
 * Le `notConfigured` du stockage est renommé `storageNotConfigured` : il dit « pas de
 * S3 », là où celui des use-cases dit « fonctionnalité éteinte ». Confondus, l'écran
 * annonçait « les événements ne sont pas activés » à un administrateur dont le réglage
 * était bel et bien actif.
 */
export async function uploadEventImageAction(formData: FormData) {
  const { schoolId } = await requireSchoolAdmin()

  const eventId = formData.get('eventId')
  const file = formData.get('file')
  if (typeof eventId !== 'string' || eventId === '' || !(file instanceof File)) {
    return 'validationError' as const
  }

  const alt = formData.get('alt')
  const bytes = new Uint8Array(await file.arrayBuffer())

  const uploaded = await uploadEventImage({
    schoolId,
    contentType: file.type,
    bytes,
    id: randomUUID(),
  })
  if (uploaded.result === 'notConfigured') return 'storageNotConfigured' as const
  if (uploaded.result !== 'OK') return uploaded.result

  const result = await addEventImage({
    schoolId,
    eventId,
    storageKey: uploaded.storageKey,
    alt: typeof alt === 'string' ? alt : undefined,
  })
  if (typeof result === 'string') return result

  revalidatePath('/dashboard/events')
  return result
}

export async function removeEventImageAction(eventId: string, imageId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await removeEventImage({ schoolId, eventId, imageId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}

export async function setEventCoverAction(eventId: string, imageId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setEventCover({ schoolId, eventId, imageId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/events')
  return result
}
