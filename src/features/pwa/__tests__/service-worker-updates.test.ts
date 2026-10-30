import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watchServiceWorkerUpdates } from '../service-worker-updates'

function createWorker(state: ServiceWorkerState) {
  return Object.assign(new EventTarget(), { state, postMessage: vi.fn() })
}

function setup(controlled = true) {
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? createWorker('activated') : null,
  })
  const registration = Object.assign(new EventTarget(), {
    waiting: null as ReturnType<typeof createWorker> | null,
    installing: null as ReturnType<typeof createWorker> | null,
  })
  const onUpdate = vi.fn<(apply: () => void) => void>()
  const reload = vi.fn()
  const watch = () =>
    watchServiceWorkerUpdates(
      container as unknown as ServiceWorkerContainer,
      registration as unknown as ServiceWorkerRegistration,
      onUpdate,
      reload
    )
  return { container, registration, onUpdate, reload, watch }
}

describe('service worker update lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers a waiting update, activates only on acceptance, then reloads once', () => {
    const { registration, container, onUpdate, reload, watch } = setup()
    const waiting = createWorker('installed')
    registration.waiting = waiting
    watch()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    onUpdate.mock.calls[0][0]()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('detects an update that finishes downloading after the page opens', () => {
    const { registration, onUpdate, watch } = setup()
    watch()
    const installing = createWorker('installing')
    registration.installing = installing
    registration.dispatchEvent(new Event('updatefound'))
    expect(onUpdate).not.toHaveBeenCalled()
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not prompt or reload on the initial installation', () => {
    const { registration, container, onUpdate, reload, watch } = setup(false)
    const installing = createWorker('installing')
    registration.installing = installing
    watch()
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    container.controller = createWorker('activated')
    container.dispatchEvent(new Event('controllerchange'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('offers a manual reload when a different tab activates an update', () => {
    const { container, onUpdate, reload, watch } = setup()
    watch()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()
    onUpdate.mock.calls[0][0]()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads an uncontrolled page if it explicitly accepts a waiting update', () => {
    const { registration, container, onUpdate, reload, watch } = setup(false)
    registration.waiting = createWorker('installed')
    watch()
    onUpdate.mock.calls[0][0]()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('removes update and controller listeners when disposed', () => {
    const { registration, container, onUpdate, reload, watch } = setup()
    const installing = createWorker('installing')
    registration.installing = installing
    const stop = watch()
    stop()
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    registration.dispatchEvent(new Event('updatefound'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
