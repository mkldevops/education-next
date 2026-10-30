/** Each tab decides when it can reload; another tab's update must not discard its edits. */
export function watchServiceWorkerUpdates(
  container: ServiceWorkerContainer,
  registration: ServiceWorkerRegistration,
  onUpdate: (apply: () => void) => void,
  reload: () => void
) {
  let controlled = Boolean(container.controller)
  let reloadRequested = false
  let reloaded = false
  let installing: ServiceWorker | null = null

  const reloadOnce = () => {
    if (reloaded) return
    reloaded = true
    reload()
  }
  const offerUpdate = (worker?: ServiceWorker) => {
    onUpdate(() => {
      if (!worker || worker.state === 'activated') {
        reloadOnce()
        return
      }
      reloadRequested = true
      worker.postMessage({ type: 'SKIP_WAITING' })
    })
  }
  const onControllerChange = () => {
    if (reloadRequested) {
      reloadOnce()
      return
    }
    // Initial installation claims existing tabs, without requiring a reload.
    if (!controlled) {
      controlled = true
      return
    }
    offerUpdate()
  }
  const onStateChange = () => {
    if (installing?.state === 'installed' && container.controller) offerUpdate(installing)
  }
  const onUpdateFound = () => {
    installing?.removeEventListener('statechange', onStateChange)
    installing = registration.installing
    installing?.addEventListener('statechange', onStateChange)
    onStateChange()
  }

  container.addEventListener('controllerchange', onControllerChange)
  registration.addEventListener('updatefound', onUpdateFound)
  onUpdateFound()
  if (registration.waiting) offerUpdate(registration.waiting)

  return () => {
    container.removeEventListener('controllerchange', onControllerChange)
    registration.removeEventListener('updatefound', onUpdateFound)
    installing?.removeEventListener('statechange', onStateChange)
  }
}
