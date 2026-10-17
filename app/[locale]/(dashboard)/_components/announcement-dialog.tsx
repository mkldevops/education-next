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
import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Link } from '@/i18n/routing'
import { markAnnouncementsSeenAction } from '../_lib/announcement-actions'
import { AnnouncementMarkdown } from './announcement-markdown'
import { AnnouncementMedia } from './announcement-media'

export type AnnouncementDialogItem = {
  title: string
  summary: string | null
  body: string | null
  imageUrl: string | null
  videoUrl: string | null
  link: string | null
}

/**
 * Pop-up de la dernière nouveauté mise en avant. Toute fermeture — bouton, Échap, clic sur le
 * fond, ou navigation vers la fonctionnalité — marque les nouveautés comme vues.
 */
export function AnnouncementDialog({ announcement }: { announcement: AnnouncementDialogItem }) {
  return (
    <Dialog initialOpen>
      <AnnouncementDialogContent announcement={announcement} />
    </Dialog>
  )
}

function AnnouncementDialogContent({ announcement }: { announcement: AnnouncementDialogItem }) {
  const t = useTranslations('dashboard.announcements')
  const { open, setOpen } = useDialog()
  const recorded = useRef(false)

  useEffect(() => {
    if (open || recorded.current) return
    recorded.current = true
    void markAnnouncementsSeenAction()
  }, [open])

  return (
    <DialogContent>
      <DialogHeader>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
          <Sparkles aria-hidden className="size-3.5" />
          {t('dialogEyebrow')}
        </p>
        <DialogTitle>{announcement.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
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
        ) : (
          <Button type="button" onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
