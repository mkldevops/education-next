'use client'

import { Button } from '@peaklab/ui'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { watchServiceWorkerUpdates } from './service-worker-updates'

export function ServiceWorkerRegister() {
  const t = useTranslations('pwa')
  const [offline, setOffline] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let wasOffline = !navigator.onLine
    setOffline(wasOffline)
    const onOffline = () => {
      wasOffline = true
      setOffline(true)
    }
    const onOnline = () => {
      setOffline(false)
      if (wasOffline) toast.success(t('reconnected'))
      wasOffline = false
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [t])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const serviceWorkers = navigator.serviceWorker
    if (process.env.NODE_ENV !== 'production') {
      void serviceWorkers
        .getRegistrations()
        .then(async (registrations) => {
          const scriptUrl = new URL('/sw.js', window.location.origin).href
          await Promise.all(
            registrations
              .filter((registration) =>
                [registration.active, registration.waiting, registration.installing].some(
                  (worker) => worker?.scriptURL === scriptUrl
                )
              )
              .map((registration) => registration.unregister())
          )
        })
        .catch(() => {})
      if ('caches' in window) {
        void caches
          .keys()
          .then((names) =>
            Promise.all(
              names
                .filter((name) => name.startsWith('education-app-'))
                .map((name) => caches.delete(name))
            )
          )
          .catch(() => {})
      }
      return
    }

    let disposed = false
    let cleanup: (() => void) | undefined
    let registration: ServiceWorkerRegistration | undefined
    let registering = false
    const register = async () => {
      if (disposed || registering) return
      registering = true
      try {
        const registered = await serviceWorkers.register('/sw.js', { updateViaCache: 'none' })
        if (disposed) return
        registration = registered
        cleanup = watchServiceWorkerUpdates(
          serviceWorkers,
          registered,
          (apply) => setApplyUpdate(() => apply),
          () => window.location.reload()
        )
      } catch {
        // Retry on reconnection/foreground; registration failure never blocks ordinary use.
      } finally {
        registering = false
      }
    }
    const checkForUpdate = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        if (registration) void registration.update().catch(() => {})
        else void register()
      }
    }
    void register()
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    return () => {
      disposed = true
      cleanup?.()
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
    }
  }, [])

  if (!offline && !applyUpdate) return null

  return (
    <aside
      aria-label={t('statusLabel')}
      className="pwa-status fixed z-50 space-y-3 rounded-lg border border-border bg-background p-4 shadow-lg sm:w-96"
    >
      {offline && (
        <p role="status" className="flex items-start gap-2 text-sm text-foreground">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t('offline')}
        </p>
      )}
      {applyUpdate && (
        <div className="space-y-3">
          <div role="status" className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t('updateReady')}</p>
            <p className="text-sm text-muted-foreground">{t('updateDescription')}</p>
          </div>
          <Button
            className="min-h-11"
            disabled={offline || applying}
            onClick={() => {
              if (!navigator.onLine) return
              setApplying(true)
              applyUpdate()
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t(applying ? 'updating' : 'reload')}
          </Button>
        </div>
      )}
    </aside>
  )
}
