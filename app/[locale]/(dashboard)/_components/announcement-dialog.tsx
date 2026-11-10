'use client'

import {
  Button,
  buttonVariants,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog,
} from '@peaklab/ui'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { markAnnouncementsSeenAction } from '../_lib/announcement-actions'
import { AnnouncementMarkdown } from './announcement-markdown'
import { AnnouncementMedia } from './announcement-media'

export type AnnouncementDialogItem = {
  id: string
  title: string
  summary: string | null
  body: string | null
  imageUrl: string | null
  videoUrl: string | null
  link: string | null
}

/**
 * Pop-up des nouveautés mises en avant, parcourues en carrousel quand il y en a plusieurs. Toute
 * fermeture — bouton, Échap, clic sur le fond, ou navigation vers la fonctionnalité — marque les
 * nouveautés comme vues.
 */
export function AnnouncementDialog({ announcements }: { announcements: AnnouncementDialogItem[] }) {
  if (announcements.length === 0) return null

  return (
    <Dialog initialOpen>
      <AnnouncementDialogContent announcements={announcements} />
    </Dialog>
  )
}

function AnnouncementDialogContent({ announcements }: { announcements: AnnouncementDialogItem[] }) {
  const t = useTranslations('dashboard.announcements')
  const { open, setOpen } = useDialog()
  const recorded = useRef(false)
  const [index, setIndex] = useState(0)

  const total = announcements.length
  const announcement = announcements[Math.min(index, total - 1)]
  const isFirst = index === 0
  const isLast = index === total - 1

  useEffect(() => {
    if (open || recorded.current) return
    recorded.current = true
    void markAnnouncementsSeenAction()
  }, [open])

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(total - 1, next)))
  }

  return (
    <DialogContent>
      <DialogHeader>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground">
          <Sparkles aria-hidden className="size-3.5" />
          {t('dialogEyebrow')}
          {total > 1 && (
            <span className="ml-auto font-normal normal-case tracking-normal text-graphite-600">
              {t('position', { current: index + 1, total })}
            </span>
          )}
        </p>
        <DialogTitle>{announcement.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <section
          key={announcement.id}
          aria-roledescription="slide"
          aria-live="polite"
          aria-label={t('position', { current: index + 1, total })}
          className="flex flex-col gap-4"
        >
          <AnnouncementMedia
            imageUrl={announcement.imageUrl}
            videoUrl={announcement.videoUrl}
            className="rounded-lg border border-border"
          />
          {announcement.summary ? (
            <p className="text-sm leading-relaxed text-graphite-600">{announcement.summary}</p>
          ) : (
            announcement.body && <AnnouncementMarkdown>{announcement.body}</AnnouncementMarkdown>
          )}
        </section>
        {total > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('previous')}
              disabled={isFirst}
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              {announcements.map((item, dotIndex) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={t('goTo', { index: dotIndex + 1 })}
                  aria-current={dotIndex === index ? 'true' : undefined}
                  onClick={() => goTo(dotIndex)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    dotIndex === index
                      ? 'w-5 bg-foreground'
                      : 'w-1.5 bg-border hover:bg-graphite-600'
                  )}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('next')}
              disabled={isLast}
              onClick={() => goTo(index + 1)}
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Link
          href="/dashboard/news"
          className={buttonVariants({ variant: 'ghost' })}
          onClick={() => setOpen(false)}
        >
          {t('seeAll')}
        </Link>
        {announcement.link ? (
          <Link
            href={announcement.link}
            className={buttonVariants()}
            onClick={() => setOpen(false)}
          >
            {t('discover')}
          </Link>
        ) : !isLast ? (
          <Button type="button" onClick={() => goTo(index + 1)}>
            {t('next')}
          </Button>
        ) : (
          <Button type="button" onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
