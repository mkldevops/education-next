import { afterEach, describe, expect, it, vi } from 'vitest'
import { leaveAfterSignOut } from './leave-after-sign-out'

describe('leaveAfterSignOut', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('replaces the page with a full load of the localized home', () => {
    const replace = vi.fn()
    vi.stubGlobal('window', { location: { replace } })

    leaveAfterSignOut('en')

    expect(replace).toHaveBeenCalledWith('/en')
  })
})
