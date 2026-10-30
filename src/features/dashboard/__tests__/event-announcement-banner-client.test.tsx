import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventAnnouncementCookieName } from '@/lib/event-announcement-cookie'
import { EventAnnouncementBannerClient } from '../event-announcement-banner-client'

const props = {
  id: 'event-1',
  updatedAt: '2026-10-30T10:00:00Z',
  message: 'Réunion des familles',
  dismissLabel: 'Masquer',
}
const cookie = eventAnnouncementCookieName(props.id, props.updatedAt)

describe('event announcement preference', () => {
  beforeEach(() => {
    localStorage.clear()
    // biome-ignore lint/suspicious/noDocumentCookie: reset the real browser preference between tests.
    document.cookie = `${cookie}=; Path=/; Max-Age=0`
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders an unhidden announcement in the first server response', () => {
    expect(renderToString(<EventAnnouncementBannerClient {...props} />)).toContain(props.message)
    expect(
      renderToString(<EventAnnouncementBannerClient {...props} initialDismissed />)
    ).not.toContain(props.message)
  })

  it('stores dismissal for the next server response and hides immediately', () => {
    render(<EventAnnouncementBannerClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }))
    expect(screen.queryByText(props.message)).not.toBeInTheDocument()
    expect(document.cookie).toContain(`${cookie}=1`)
    expect(localStorage.getItem(`event-dismissed:${props.id}:${props.updatedAt}`)).toBe('1')
  })

  it('migrates an existing local preference and makes an edited event visible', () => {
    localStorage.setItem(`event-dismissed:${props.id}:${props.updatedAt}`, '1')
    const { rerender } = render(<EventAnnouncementBannerClient {...props} />)
    expect(screen.queryByText(props.message)).not.toBeInTheDocument()
    expect(document.cookie).toContain(`${cookie}=1`)
    rerender(<EventAnnouncementBannerClient {...props} updatedAt="2026-10-31T10:00:00Z" />)
    expect(screen.getByText(props.message)).toBeInTheDocument()
  })

  it('allows dismissal even if local storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Unavailable')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Unavailable')
    })
    render(<EventAnnouncementBannerClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }))
    expect(screen.queryByText(props.message)).not.toBeInTheDocument()
    expect(document.cookie).toContain(`${cookie}=1`)
  })
})
