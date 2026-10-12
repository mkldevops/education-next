import { afterEach, describe, expect, it, vi } from 'vitest'
import { UmamiScript } from '../umami-script'

describe('UmamiScript', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads nothing when Umami is not configured', () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', '')
    vi.stubEnv('UMAMI_WEBSITE_ID', 'site-1')

    expect(UmamiScript()).toBeNull()
  })

  it('points the script at the configured website without sending query strings', () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://umami.example.test/script.js')
    vi.stubEnv('UMAMI_WEBSITE_ID', 'site-1')

    expect(UmamiScript()?.props).toMatchObject({
      src: 'https://umami.example.test/script.js',
      'data-website-id': 'site-1',
      'data-exclude-search': 'true',
    })
  })
})
