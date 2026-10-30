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

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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

function GuideCloseButton() {
  const t = useTranslations('pwa.install')
  const { setOpen } = useDialog()
  return <Button onClick={() => setOpen(false)}>{t('close')}</Button>
}

export function InstallApp({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('pwa.install')
  const promptRef = useRef<InstallPromptEvent | null>(null)
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
    const onPrompt = (event: Event) => {
      if (installedRef.current || isStandalone()) return
      event.preventDefault()
      promptRef.current = event as InstallPromptEvent
      setAvailable(true)
    }
    const onInstalled = () => {
      installedRef.current = true
      promptRef.current = null
      setAvailable(false)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    displayMode.addEventListener('change', updateDisplay)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      displayMode.removeEventListener('change', updateDisplay)
    }
  }, [])

  async function install() {
    const prompt = promptRef.current
    if (!prompt) return
    // An install event can only be used once, even if the user dismisses it.
    promptRef.current = null
    setAvailable(false)
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

  if (installed) return null
  if (available) {
    return (
      <Button variant="outline" size="sm" className="min-h-11 min-w-11" onClick={install}>
        <Download aria-hidden="true" size={16} />
        <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{t('button')}</span>
      </Button>
    )
  }
  if (!ios) return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="min-h-11 min-w-11">
          <Download aria-hidden="true" size={16} />
          <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{t('iosButton')}</span>
        </Button>
      </DialogTrigger>
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
    </Dialog>
  )
}
