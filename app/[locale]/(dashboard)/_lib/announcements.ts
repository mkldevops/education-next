import { cache } from 'react'
import type { Announcement, AnnouncementReader } from '@/domain/announcement'
import { listAnnouncements } from '@/gateways/announcement-gateway'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'

export type AnnouncementFeed = {
  announcements: Announcement[]
  reader: AnnouncementReader
}

/**
 * Nouveautés et lecteur courant, mémoïsés pour la durée d'un rendu : la pop-up, la pastille de
 * l'en-tête et la page `/dashboard/news` partagent la même lecture. `null` hors école active.
 */
export const getAnnouncementFeed = cache(
  async (locale: string): Promise<AnnouncementFeed | null> => {
    const context = await getSchoolContext()
    if (!context) return null

    const [user, announcements] = await Promise.all([
      db.user.findUnique({
        where: { id: context.userId },
        select: { announcementsSeenAt: true, createdAt: true },
      }),
      listAnnouncements(locale),
    ])
    if (!user) return null

    return {
      announcements,
      reader: {
        roles: context.roles,
        isSuperAdmin: context.isSuperAdmin,
        seenAt: user.announcementsSeenAt ?? user.createdAt,
      },
    }
  }
)
