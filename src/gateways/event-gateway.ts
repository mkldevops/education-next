import type { EventCategory, EventStatus, EventVisibility, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

const withImages = { images: { orderBy: { position: 'asc' } } } satisfies Prisma.EventInclude

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

  // `expectedStatus` pose le statut lu par l'appelant dans la condition de l'écriture : une
  // publication survenue entre la lecture et l'écriture fait échouer la mise à jour au lieu
  // de modifier un événement déjà diffusé.
  update: (schoolId: string, id: string, data: UpdateEventData, expectedStatus?: EventStatus) =>
    db.event.update({
      where: {
        id_schoolId: { id, schoolId },
        ...(expectedStatus ? { status: expectedStatus } : {}),
      },
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
      include: withImages,
    }),

  findBySlug: (schoolId: string, slug: string) => db.event.findFirst({ where: { schoolId, slug } }),

  findBySlugWithImages: (schoolId: string, slug: string) =>
    db.event.findFirst({
      where: { schoolId, slug },
      include: withImages,
    }),

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
      include: withImages,
      orderBy: { startAt: 'asc' },
    }),

  // Carte « Prochains événements » du tableau de bord : visibilités du rôle appelant, à
  // partir d'aujourd'hui (minuit UTC), `take` pour rester borné — la carte n'en affiche
  // qu'une poignée.
  listUpcoming: (schoolId: string, visibilities: EventVisibility[], from: Date, take?: number) =>
    db.event.findMany({
      where: {
        schoolId,
        visibility: { in: visibilities },
        status: { in: ['PUBLISHED', 'CANCELLED'] },
        startAt: { gte: from },
      },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      orderBy: { startAt: 'asc' },
      ...(take !== undefined ? { take } : {}),
    }),

  // Bandeau J-x exclusivement : seul un événement PUBLISHED dont `announceDaysBefore`
  // n'est pas `null` peut jamais être choisi par `selectAnnouncedEvent`. Filtrer les deux
  // ici, avant `take`, garantit que le plafond ne porte que sur des lignes réellement
  // sélectionnables — un long calendrier d'école (vacances, fermetures, réunions) sans
  // annonce sur la plupart de ses lignes ne peut donc plus remplir le lot avant d'atteindre
  // le seul événement qui compte.
  listAnnounceable: (schoolId: string, visibilities: EventVisibility[], from: Date, take: number) =>
    db.event.findMany({
      where: {
        schoolId,
        visibility: { in: visibilities },
        status: 'PUBLISHED',
        announceDaysBefore: { not: null },
        startAt: { gte: from },
      },
      orderBy: { startAt: 'asc' },
      take,
    }),

  // Positions réécrites dans une seule transaction : un lecteur ne voit jamais deux
  // couvertures ni un trou, et seules les lignes dont la position change sont touchées.
  reorderImages: (schoolId: string, eventId: string, orderedImageIds: string[]) =>
    db.$transaction(async (tx) => {
      const images = await tx.eventImage.findMany({ where: { schoolId, eventId } })
      const byId = new Map(images.map((image) => [image.id, image]))

      return Promise.all(
        orderedImageIds.map((imageId, position) => {
          const image = byId.get(imageId)
          if (!image) throw new Error(`Image ${imageId} does not belong to event ${eventId}`)
          return image.position === position
            ? image
            : tx.eventImage.update({
                where: { id_schoolId: { id: imageId, schoolId } },
                data: { position },
              })
        })
      )
    }),
}
