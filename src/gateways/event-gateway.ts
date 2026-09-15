import type { EventCategory, EventStatus, EventVisibility } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export type EventData = {
  title: string
  slug: string
  summary?: string | null
  description?: string | null
  category: EventCategory
  visibility?: EventVisibility
  status?: EventStatus
  allDay?: boolean
  startAt: Date
  endAt?: Date | null
  location?: string | null
  announceDaysBefore?: number | null
}

export type UpdateEventData = Partial<EventData>

export type EventImageData = {
  eventId: string
  storageKey: string
  alt?: string | null
  position: number
}

export const eventGateway = {
  create: (schoolId: string, data: EventData) => db.event.create({ data: { ...data, schoolId } }),

  update: (schoolId: string, id: string, data: UpdateEventData) =>
    db.event.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  archive: (schoolId: string, id: string) =>
    db.event.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),

  findById: (schoolId: string, id: string) =>
    db.event.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: { images: { orderBy: { position: 'asc' } } },
    }),

  findBySlug: (schoolId: string, slug: string) => db.event.findFirst({ where: { schoolId, slug } }),

  countImages: (schoolId: string, eventId: string) =>
    db.eventImage.count({ where: { schoolId, eventId } }),

  addImage: (schoolId: string, data: EventImageData) =>
    db.eventImage.create({ data: { ...data, schoolId } }),

  // `EventImage` n'a pas de soft-delete (cf. commentaire du modèle) : la suppression est
  // réelle. La renumérotation qui suit tient dans la même transaction que la suppression,
  // pour qu'aucun lecteur ne puisse jamais observer un trou dans les positions.
  removeImage: (schoolId: string, eventId: string, imageId: string) =>
    db.$transaction(async (tx) => {
      await tx.eventImage.delete({
        where: { id_schoolId: { id: imageId, schoolId } },
      })

      const remaining = await tx.eventImage.findMany({
        where: { schoolId, eventId },
        orderBy: { position: 'asc' },
      })

      return Promise.all(
        remaining.map((image, position) =>
          image.position === position
            ? image
            : tx.eventImage.update({
                where: { id_schoolId: { id: image.id, schoolId } },
                data: { position },
              })
        )
      )
    }),
}
