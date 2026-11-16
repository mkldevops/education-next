import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureError } from './client-error-tracking'

const options = {
  dsn: 'https://k@gt.example/1',
  environment: 'eic',
  sendDefaultPii: false,
} as const

async function freshModule() {
  vi.resetModules()
  return import('./client-error-tracking')
}

function loaderWith(send: CaptureError) {
  const initSentry = vi.fn(() => send)
  return { initSentry, load: vi.fn(async () => ({ initSentry })) }
}

function rejection(reason: unknown) {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

describe('client error tracking', () => {
  let target: EventTarget

  beforeEach(() => {
    target = new EventTarget()
  })

  it('replays errors raised before Sentry loads, then hands over to Sentry', async () => {
    const tracking = await freshModule()
    tracking.bufferGlobalErrors(target as Window)
    const boom = new Error('boom')
    target.dispatchEvent(new ErrorEvent('error', { error: boom }))
    target.dispatchEvent(rejection('rejected'))
    tracking.captureClientException('from boundary')

    const send = vi.fn<CaptureError>()
    const { initSentry, load } = loaderWith(send)
    await tracking.startClientErrorTracking(options, load)

    expect(initSentry).toHaveBeenCalledWith(options)
    expect(send.mock.calls).toEqual([
      [boom, true],
      ['rejected', true],
      ['from boundary', false],
    ])

    send.mockClear()
    target.dispatchEvent(new ErrorEvent('error', { error: new Error('after') }))
    expect(send).not.toHaveBeenCalled()
    tracking.captureClientException('direct')
    expect(send).toHaveBeenCalledWith('direct', false)
  })

  it('keeps the message when the error object is missing', async () => {
    const tracking = await freshModule()
    tracking.bufferGlobalErrors(target as Window)
    target.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))

    const send = vi.fn<CaptureError>()
    await tracking.startClientErrorTracking(options, loaderWith(send).load)

    expect(send).toHaveBeenCalledWith('Script error.', true)
  })

  it('caps the buffer at 20 errors', async () => {
    const tracking = await freshModule()
    tracking.bufferGlobalErrors(target as Window)
    for (let i = 0; i < 30; i++) target.dispatchEvent(rejection(i))

    const send = vi.fn<CaptureError>()
    await tracking.startClientErrorTracking(options, loaderWith(send).load)

    expect(send).toHaveBeenCalledTimes(20)
    expect(send).toHaveBeenLastCalledWith(19, true)
  })

  it('loads Sentry once', async () => {
    const tracking = await freshModule()
    const { load } = loaderWith(vi.fn())
    await Promise.all([
      tracking.startClientErrorTracking(options, load),
      tracking.startClientErrorTracking(options, load),
    ])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the buffer and retries a failed chunk load a bounded number of times', async () => {
    vi.useFakeTimers()
    try {
      const tracking = await freshModule()
      tracking.bufferGlobalErrors(target as Window)
      target.dispatchEvent(rejection('early'))

      const failing = vi.fn(() => Promise.reject(new Error('chunk')))
      await tracking.startClientErrorTracking(options, failing)
      await vi.runAllTimersAsync()
      expect(failing).toHaveBeenCalledTimes(3)

      const send = vi.fn<CaptureError>()
      await tracking.startClientErrorTracking(options, loaderWith(send).load)
      expect(send).toHaveBeenCalledWith('early', true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers on its own when a retry succeeds', async () => {
    vi.useFakeTimers()
    try {
      const tracking = await freshModule()
      tracking.captureClientException('queued')
      const send = vi.fn<CaptureError>()
      const { initSentry } = loaderWith(send)
      const flaky = vi
        .fn<() => Promise<{ initSentry: typeof initSentry }>>()
        .mockRejectedValueOnce(new Error('chunk'))
        .mockResolvedValue({ initSentry })

      await tracking.startClientErrorTracking(options, flaky)
      expect(send).not.toHaveBeenCalled()
      await vi.runAllTimersAsync()

      expect(flaky).toHaveBeenCalledTimes(2)
      expect(send).toHaveBeenCalledWith('queued', false)
    } finally {
      vi.useRealTimers()
    }
  })
})
