import { headers } from 'next/headers'
import { resolvePopupAnnouncement, safeAnnouncementLink } from '@/domain/announcement'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'
import { getAnnouncementFeed } from '../_lib/announcements'
import { AnnouncementDialog } from './announcement-dialog'

/**
 * Affiche la dernière nouveauté mise en avant que l'utilisateur n'a pas encore vue. Rien pendant
 * un emprunt d'identité : la fermeture marquerait les nouveautés comme vues pour la cible.
 */
export async function AnnouncementGate({ locale }: { locale: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || isImpersonating(session)) return null

  const feed = await getAnnouncementFeed(locale)
  if (!feed) return null

  const announcement = resolvePopupAnnouncement(feed.announcements, feed.reader)
  if (!announcement) return null

  return (
    <AnnouncementDialog
      key={announcement.id}
      announcement={{
        title: announcement.title,
        summary: announcement.summary,
        body: announcement.body,
        imageUrl: announcement.imageUrl,
        videoUrl: announcement.videoUrl,
        link: safeAnnouncementLink(announcement.link),
      }}
    />
  )
}
