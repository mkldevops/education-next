import * as Sentry from '@sentry/nextjs'
import { describe, expect, it, vi } from 'vitest'
import { initSentry } from './sentry-client'

vi.mock('@sentry/nextjs', () => ({
  getClient: vi.fn(() => undefined),
  init: vi.fn(),
  captureException: vi.fn(),
}))

const options = {
  dsn: 'https://k@gt.example/1',
  environment: 'eic',
  sendDefaultPii: false,
} as const

describe('initSentry', () => {
  it('initialises Sentry without browser tracing and marks global errors as unhandled', () => {
    const send = initSentry(options)

    const config = vi.mocked(Sentry.init).mock.calls[0]?.[0]
    expect(config).toMatchObject(options)
    expect(config).not.toHaveProperty('tracesSampleRate')
    const integrations = config?.integrations as (
      defaults: { name: string }[]
    ) => { name: string }[]
    expect(integrations([{ name: 'BrowserTracing' }, { name: 'GlobalHandlers' }])).toEqual([
      { name: 'GlobalHandlers' },
    ])

    const error = new Error('boom')
    send(error, true)
    expect(Sentry.captureException).toHaveBeenLastCalledWith(error, {
      mechanism: { type: 'onerror.deferred', handled: false },
    })
    send(error, false)
    expect(Sentry.captureException).toHaveBeenLastCalledWith(error, undefined)
  })
})
