'use client'

import { Button, buttonVariants, useMenu } from '@peaklab/ui'
import { ExternalLink, Link2, MoreHorizontal, Printer } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { type ComponentProps, type CSSProperties, useEffect, useState } from 'react'
import { type EventPageAccess, eventPublicPath, resolveEventPageAccess } from '@/domain/event'
import { Link } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { ArchiveEventDialog } from './archive-event-dialog'
import { DuplicateEventDialog } from './duplicate-event-dialog'
import { EditEventDialog } from './edit-event-dialog'
import { EventImagesDialog } from './event-images-dialog'

type Props = {
  event: ComponentProps<typeof EditEventDialog>['event'] & {
    slug: string
    images: ComponentProps<typeof EventImagesDialog>['images']
  }
  schoolSlug: string
  nextStartLabel: string
}

const MENU_WIDTH = 224
/** Hauteur approchée du panneau, pour l'ouvrir vers le haut quand la ligne est en bas d'écran. */
const MENU_HEIGHT = 300

const linkItemClass = `${buttonVariants({ variant: 'ghost', size: 'sm' })} w-full justify-start`

/**
 * Actions d'un événement, repliées derrière un seul bouton.
 *
 * Même mécanique que `LevelActionsMenu` : le panneau est masqué en CSS plutôt que démonté,
 * sans quoi fermer le menu fermerait aussi le dialogue qu'on vient d'y ouvrir.
 *
 * Comme `PeriodRowActions`, le panneau est `fixed` d'après le rectangle du déclencheur :
 * l'`overflow-x-auto` de `DataTable` rogne aussi la verticale et couperait un menu absolu.
 */
export function EventActionsMenu({ event, schoolSlug, nextStartLabel }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const locale = useLocale()
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [anchor, setAnchor] = useState<CSSProperties>()

  // Un panneau `fixed` ne suit pas le défilement : le refermer vaut mieux que le laisser
  // flotter loin de sa ligne.
  useEffect(() => {
    if (!open) return
    const dismiss = () => close(false)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open, close])

  const onTriggerClick = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.max(8, rect.right - MENU_WIDTH)
      const opensUp = window.innerHeight - rect.bottom < MENU_HEIGHT && rect.top > MENU_HEIGHT
      setAnchor(
        opensUp
          ? { left, bottom: window.innerHeight - rect.top + 4 }
          : { left, top: rect.bottom + 4 }
      )
    }
    toggle()
  }

  const publicPath = eventPublicPath(schoolSlug, event.slug)
  // L'aperçu d'un administrateur ne compte pas : le lien copié part vers des visiteurs.
  const publicAccess: EventPageAccess = resolveEventPageAccess(event, false)

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/${locale}${publicPath}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      toast.error(t('publicLink.copyFailed'))
      return
    }
    close()
    if (publicAccess === 'public') toast.success(t('publicLink.copied'))
    else toast.warning(t('publicLink.copiedPrivate'))
  }

  return (
    <div className="relative flex justify-end" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={onTriggerClick}
        aria-label={t('columns.actions')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded p-1 text-graphite-600 hover:bg-alabaster-800 hover:text-graphite"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <div
        ref={menuRef}
        role="menu"
        style={anchor}
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${
          open ? '' : 'hidden'
        }`}
      >
        <EditEventDialog event={event} triggerRole="menuitem" restoreFocusRef={triggerRef} />
        <EventImagesDialog
          eventId={event.id}
          eventTitle={event.title}
          images={event.images}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
        <DuplicateEventDialog
          eventId={event.id}
          title={event.title}
          nextStartLabel={nextStartLabel}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
        <Link
          role="menuitem"
          href={`/dashboard/events/${event.id}/affiche`}
          onClick={() => close(false)}
          className={linkItemClass}
        >
          <Printer className="h-4 w-4" />
          {t('poster.trigger')}
        </Link>

        <hr className="my-0.5 border-alabaster-700" />

        <Link
          role="menuitem"
          href={publicPath}
          target="_blank"
          rel="noopener"
          onClick={() => close(false)}
          className={linkItemClass}
        >
          <ExternalLink className="h-4 w-4" />
          {publicAccess === 'public' ? t('publicLink.view') : t('publicLink.preview')}
        </Link>
        <Button variant="ghost" size="sm" role="menuitem" onClick={copyPublicLink}>
          <Link2 className="h-4 w-4" />
          {t('publicLink.copy')}
        </Button>

        <hr className="my-0.5 border-alabaster-700" />

        <ArchiveEventDialog
          eventId={event.id}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
      </div>
    </div>
  )
}
