import { Megaphone } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { countUnreadAnnouncements } from '@/domain/announcement'
import { Link } from '@/i18n/routing'
import { getAnnouncementFeed } from '../_lib/announcements'

/** Entrée « Nouveautés » de l'en-tête, avec une pastille tant qu'il reste des nouveautés non vues. */
export async function AnnouncementsButton({ locale }: { locale: string }) {
  const feed = await getAnnouncementFeed(locale)
  if (!feed) return null

  const t = await getTranslations({ locale, namespace: 'dashboard.announcements' })
  const unread = countUnreadAnnouncements(feed.announcements, feed.reader)

  return (
    <Link
      href="/dashboard/news"
      aria-label={unread > 0 ? t('buttonLabelUnread', { count: unread }) : t('buttonLabel')}
      title={t('buttonLabel')}
      className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Megaphone size={20} strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
        />
      )}
    </Link>
  )
}
