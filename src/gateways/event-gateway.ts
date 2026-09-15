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

  // Diffusion publique : visibilité PUBLIC uniquement, DRAFT jamais exposé — CANCELLED
  // reste diffusé, barré côté rendu (cf. doctrine du modèle). `filterVisibleEvents`
  // (domaine) rejoue ce même filtre en défense en profondeur chez l'appelant.
  listPublic: (schoolId: string) =>
    db.event.findMany({
      where: { schoolId, visibility: 'PUBLIC', status: { in: ['PUBLISHED', 'CANCELLED'] } },
      include: { images: { orderBy: { position: 'asc' } } },
      orderBy: { startAt: 'asc' },
    }),

  // Bandeau J-x et carte « Prochains événements » du tableau de bord : visibilités du
  // rôle appelant, à partir d'aujourd'hui (minuit UTC) pour rester borné. `take` plafonne
  // le lot ramené — la carte n'en affiche qu'une poignée, et le bandeau n'a besoin que du
  // plus proche parmi eux.
  listUpcoming: (schoolId: string, visibilities: EventVisibility[], from: Date, take?: number) =>
    db.event.findMany({
      where: {
        schoolId,
        visibility: { in: visibilities },
        status: { in: ['PUBLISHED', 'CANCELLED'] },
        startAt: { gte: from },
      },
      orderBy: { startAt: 'asc' },
      ...(take !== undefined ? { take } : {}),
    }),
}
