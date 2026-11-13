import { describe, expect, it } from 'vitest'
import { errorTrackingOptions, serverErrorTrackingOptions } from './options'

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

describe('serverErrorTrackingOptions', () => {
  it('stays off under tests even with a DSN', () => {
    expect(
      serverErrorTrackingOptions({ SENTRY_DSN: 'https://k@gt.example/1', NODE_ENV: 'test' })
    ).toBeNull()
  })
})
