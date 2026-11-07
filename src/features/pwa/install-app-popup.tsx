'use client'

import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { type InstallMode, useInstallApp } from './install-app'

export const INSTALL_POPUP_DISMISSED_KEY = 'pwa-install-popup-dismissed-at'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
const OPEN_DELAY_MS = 1500

function wasDismissedRecently() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(INSTALL_POPUP_DISMISSED_KEY))
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < SNOOZE_MS
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(INSTALL_POPUP_DISMISSED_KEY, String(Date.now()))
  } catch {
    // Without storage the popup simply comes back on the next visit.
  }
}

/** Propose l'installation une fois par visite tant que l'application n'est pas installée. */
export function InstallAppPopup() {
  const { mode, install } = useInstallApp()
  if (!mode) return null

  return (
    <Dialog>
      <InstallAppPopupContent mode={mode} install={install} />
    </Dialog>
  )
}

function InstallAppPopupContent({
  mode,
  install,
}: {
  mode: Exclude<InstallMode, null>
  install: () => Promise<void>
}) {
  const t = useTranslations('pwa.install')
  const { open, setOpen } = useDialog()
  const shownRef = useRef(false)

  useEffect(() => {
    if (shownRef.current || wasDismissedRecently()) return
    const timer = window.setTimeout(() => {
      shownRef.current = true
      setOpen(true)
    }, OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [setOpen])

  useEffect(() => {
    if (shownRef.current && !open) rememberDismissal()
  }, [open])

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('popupTitle')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Download size={20} />
          </span>
          <p className="text-sm text-muted-foreground">{t('popupDescription')}</p>
        </div>
        {mode === 'ios' && (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>{t('stepSafari')}</li>
            <li>{t('stepShare')}</li>
            <li>{t('stepAdd')}</li>
          </ol>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('later')}
        </Button>
        {mode === 'native' && (
          <Button
            onClick={() => {
              rememberDismissal()
              setOpen(false)
              void install()
            }}
          >
            <Download aria-hidden="true" size={16} />
            {t('button')}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
