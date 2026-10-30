import { Breadcrumbs, buttonVariants } from '@peaklab/ui'
import { ArrowRight, Megaphone } from 'lucide-react'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
  countUnreadAnnouncements,
  isAnnouncementUnread,
  safeAnnouncementLink,
  visibleAnnouncements,
} from '@/domain/announcement'
import { Link } from '@/i18n/routing'
import { formatDateLong } from '@/lib/date'
import { AnnouncementMarkdown } from '../../_components/announcement-markdown'
import { AnnouncementMedia } from '../../_components/announcement-media'
import { AnnouncementNewBadge } from '../../_components/announcement-new-badge'
import { MarkAnnouncementsSeen } from '../../_components/mark-announcements-seen'
import { getAnnouncementFeed } from '../../_lib/announcements'
import { requireSchoolSession } from '../../_lib/auth-helper'

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  await requireSchoolSession()
  const [t, tBreadcrumbs, feed] = await Promise.all([
    getTranslations('dashboard.announcements'),
    getTranslations('dashboard.breadcrumbs'),
    getAnnouncementFeed(locale),
  ])
  const announcements = feed ? visibleAnnouncements(feed.announcements, feed.reader) : []
  const hasUnread = feed ? countUnreadAnnouncements(feed.announcements, feed.reader) > 0 : false

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {hasUnread && <MarkAnnouncementsSeen />}
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('news') },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-graphite">{t('title')}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-graphite-600">{t('subtitle')}</p>
      </header>
      {announcements.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-alabaster-700 bg-white px-6 py-14 text-center">
          <Megaphone aria-hidden="true" className="mx-auto mb-4 size-10 text-foreground" />
          <h2 className="font-semibold text-graphite">{t('emptyTitle')}</h2>
          <p className="mt-2 text-sm text-graphite-600">{t('empty')}</p>
        </section>
      ) : (
        <ol className="space-y-6">
          {announcements.map((announcement) => {
            const link = safeAnnouncementLink(announcement.link)
            const isNew = feed !== null && isAnnouncementUnread(announcement, feed.reader)

            return (
              <li
                key={announcement.id}
                className="overflow-hidden rounded-3xl border border-alabaster-700 bg-white shadow-sm"
              >
                <article>
                  <AnnouncementMedia
                    imageUrl={announcement.imageUrl}
                    videoUrl={announcement.videoUrl}
                    className="border-b border-alabaster-800"
                  />
                  <div className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-graphite-600">
                      <time dateTime={announcement.publishedAt.toISOString()}>
                        {t('publishedOn', {
                          date: formatDateLong(announcement.publishedAt, locale),
                        })}
                      </time>
                      <AnnouncementNewBadge isNew={isNew} label={t('new')} />
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-graphite">
                      {announcement.title}
                    </h2>
                    {announcement.summary && (
                      <p className="text-sm leading-relaxed text-graphite-600">
                        {announcement.summary}
                      </p>
                    )}
                    {announcement.body && (
                      <AnnouncementMarkdown>{announcement.body}</AnnouncementMarkdown>
                    )}
                    {link && (
                      <Link href={link} className={buttonVariants({ size: 'sm' })}>
                        {t('discover')}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
