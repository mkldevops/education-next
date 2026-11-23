import { describe, expect, it } from 'vitest'
import {
  clientErrorTrackingOptions,
  errorTrackingOptions,
  serverErrorTrackingOptions,
} from './options'

describe('errorTrackingOptions', () => {
  it('stays off without a DSN', () => {
    expect(errorTrackingOptions(undefined, 'eic')).toBeNull()
    expect(errorTrackingOptions('  ', 'eic')).toBeNull()
  })

  it('sends errors only, without personal data', () => {
    expect(errorTrackingOptions(' https://k@gt.example/1 ', ' eic ')).toEqual({
      dsn: 'https://k@gt.example/1',
      environment: 'eic',
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
  })

  it('defaults the environment to production', () => {
    expect(errorTrackingOptions('https://k@gt.example/1', '')?.environment).toBe('production')
  })
})

describe('clientErrorTrackingOptions', () => {
  it('leaves performance tracing out of the browser', () => {
    expect(clientErrorTrackingOptions(' https://k@gt.example/1 ', ' eic ')).toEqual({
      dsn: 'https://k@gt.example/1',
      environment: 'eic',
      sendDefaultPii: false,
    })
    expect(clientErrorTrackingOptions(undefined, 'eic')).toBeNull()
  })
})

describe('serverErrorTrackingOptions', () => {
  it('stays off under tests even with a DSN', () => {
    expect(
      serverErrorTrackingOptions({ SENTRY_DSN: 'https://k@gt.example/1', NODE_ENV: 'test' })
    ).toBeNull()
  })
})
