import { headers } from 'next/headers'
import { resolvePopupAnnouncements, safeAnnouncementLink } from '@/domain/announcement'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'
import { getAnnouncementFeed } from '../_lib/announcements'
import { AnnouncementDialog } from './announcement-dialog'

/**
 * Affiche les nouveautés mises en avant, actives et non vues. Rien pendant
 * un emprunt d'identité : la fermeture marquerait les nouveautés comme vues pour la cible.
 */
export async function AnnouncementGate({ locale }: { locale: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || isImpersonating(session)) return null

  const feed = await getAnnouncementFeed(locale)
  if (!feed) return null

  const announcements = resolvePopupAnnouncements(feed.announcements, feed.reader)
  if (announcements.length === 0) return null

  return (
    <AnnouncementDialog
      key={announcements.map((announcement) => announcement.id).join(',')}
      announcements={announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        summary: announcement.summary,
        body: announcement.body,
        imageUrl: announcement.imageUrl,
        videoUrl: announcement.videoUrl,
        link: safeAnnouncementLink(announcement.link),
      }))}
    />
  )
}
