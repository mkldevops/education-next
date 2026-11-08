'use client'

import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import {
  getInstallPrompt,
  INSTALL_PROMPT_READY,
  type InstallPromptEvent,
  setInstallPrompt,
} from './install-prompt'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** `native` : invite du navigateur disponible ; `ios` : ajout manuel guidé ; `null` : rien à proposer. */
export type InstallMode = 'native' | 'ios' | null

/**
 * État d'installation partagé par chaque point d'entrée (bouton, menu, popup) : l'invite du
 * navigateur vit sur `window`, et la consommer prévient les autres instances.
 */
export function useInstallApp() {
  const installedRef = useRef(false)
  const [available, setAvailable] = useState(false)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateDisplay = () => {
      const standalone = isStandalone()
      installedRef.current = standalone
      setInstalled(standalone)
    }
    updateDisplay()
    setIos(isIos())
    const sync = () => setAvailable(getInstallPrompt() !== null && !installedRef.current)
    sync()
    const onPrompt = (event: Event) => {
      if (installedRef.current || isStandalone()) return
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
      sync()
    }
    const onInstalled = () => {
      installedRef.current = true
      setInstallPrompt(null)
      setAvailable(false)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener(INSTALL_PROMPT_READY, sync)
    window.addEventListener('appinstalled', onInstalled)
    displayMode.addEventListener('change', updateDisplay)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener(INSTALL_PROMPT_READY, sync)
      window.removeEventListener('appinstalled', onInstalled)
      displayMode.removeEventListener('change', updateDisplay)
    }
  }, [])

  async function install() {
    const prompt = getInstallPrompt()
    if (!prompt) return
    // An install event can only be used once, even if the user dismisses it.
    setInstallPrompt(null)
    window.dispatchEvent(new Event(INSTALL_PROMPT_READY))
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') {
        installedRef.current = true
        setInstalled(true)
      }
    } catch {
      // A later beforeinstallprompt event can offer another attempt.
    }
  }

  const mode: InstallMode = installed ? null : available ? 'native' : ios ? 'ios' : null
  return { mode, install }
}

function GuideCloseButton() {
  const t = useTranslations('pwa.install')
  const { setOpen } = useDialog()
  return <Button onClick={() => setOpen(false)}>{t('close')}</Button>
}

/** Étapes d'ajout à l'écran d'accueil sur iOS, à placer dans un `Dialog`. */
export function IosInstallGuide() {
  const t = useTranslations('pwa.install')
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t('stepSafari')}</li>
          <li>{t('stepShare')}</li>
          <li>{t('stepAdd')}</li>
        </ol>
      </DialogBody>
      <DialogFooter>
        <GuideCloseButton />
      </DialogFooter>
    </DialogContent>
  )
}

export function InstallApp({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('pwa.install')
  const { mode, install } = useInstallApp()

  if (mode === 'native') {
    return (
      <Button variant="outline" size="sm" className="min-h-11 min-w-11" onClick={install}>
        <Download aria-hidden="true" size={16} />
        <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{t('button')}</span>
      </Button>
    )
  }
  if (mode !== 'ios') return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="min-h-11 min-w-11">
          <Download aria-hidden="true" size={16} />
          <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{t('iosButton')}</span>
        </Button>
      </DialogTrigger>
      <IosInstallGuide />
    </Dialog>
  )
}
