import { describe, expect, it } from 'vitest'
import {
  type Announcement,
  type AnnouncementReader,
  countUnreadAnnouncements,
  isAnnouncementVisible,
  resolvePopupAnnouncement,
  safeAnnouncementLink,
  visibleAnnouncements,
} from '@/domain/announcement'

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    publishedAt: new Date('2026-10-10T10:00:00Z'),
    highlight: false,
    audience: ['ADMIN', 'TEACHER', 'PARENT'],
    link: null,
    imageUrl: null,
    videoUrl: null,
    title: 'Titre',
    summary: null,
    body: null,
    ...overrides,
  }
}

const parent: AnnouncementReader = {
  role: 'PARENT',
  isSuperAdmin: false,
  seenAt: new Date('2026-10-01T00:00:00Z'),
}

describe('isAnnouncementVisible', () => {
  it('shows an announcement to a role in its audience', () => {
    expect(isAnnouncementVisible(announcement(), parent)).toBe(true)
  })

  it('hides an announcement from a role outside its audience', () => {
    expect(isAnnouncementVisible(announcement({ audience: ['ADMIN'] }), parent)).toBe(false)
  })

  it('hides every announcement from a reader without a school role', () => {
    expect(isAnnouncementVisible(announcement(), { ...parent, role: null })).toBe(false)
  })

  it('shows every announcement to a super-admin, empty audience included', () => {
    const superAdmin = { ...parent, role: null, isSuperAdmin: true }
    expect(isAnnouncementVisible(announcement({ audience: [] }), superAdmin)).toBe(true)
  })
})

describe('visibleAnnouncements', () => {
  it('keeps the visible announcements, newest first', () => {
    const older = announcement({ id: 'old', publishedAt: new Date('2026-09-01T00:00:00Z') })
    const newer = announcement({ id: 'new', publishedAt: new Date('2026-10-12T00:00:00Z') })
    const hidden = announcement({ id: 'admin', audience: ['ADMIN'] })

    expect(visibleAnnouncements([older, hidden, newer], parent).map((a) => a.id)).toEqual([
      'new',
      'old',
    ])
  })
})

describe('countUnreadAnnouncements', () => {
  it('counts only the visible announcements published after the last visit', () => {
    const items = [
      announcement({ id: 'unread' }),
      announcement({ id: 'read', publishedAt: new Date('2026-09-01T00:00:00Z') }),
      announcement({ id: 'hidden', audience: ['ADMIN'] }),
    ]

    expect(countUnreadAnnouncements(items, parent)).toBe(1)
  })
})

describe('resolvePopupAnnouncement', () => {
  it('returns the newest unread highlighted announcement', () => {
    const items = [
      announcement({ id: 'plain', publishedAt: new Date('2026-10-14T00:00:00Z') }),
      announcement({ id: 'older', highlight: true }),
      announcement({
        id: 'latest',
        highlight: true,
        publishedAt: new Date('2026-10-12T00:00:00Z'),
      }),
    ]

    expect(resolvePopupAnnouncement(items, parent)?.id).toBe('latest')
  })

  it('returns nothing once the highlighted announcement has been seen', () => {
    const reader = { ...parent, seenAt: new Date('2026-10-11T00:00:00Z') }

    expect(resolvePopupAnnouncement([announcement({ highlight: true })], reader)).toBeNull()
  })

  it('ignores a highlighted announcement outside the reader audience', () => {
    const items = [announcement({ highlight: true, audience: ['ADMIN'] })]

    expect(resolvePopupAnnouncement(items, parent)).toBeNull()
  })
})

describe('safeAnnouncementLink', () => {
  it.each([
    ['/dashboard/attendance', '/dashboard/attendance'],
    ['  /dashboard/events?tab=1  ', '/dashboard/events?tab=1'],
  ])('keeps the internal path %s', (link, expected) => {
    expect(safeAnnouncementLink(link)).toBe(expected)
  })

  it.each([
    null,
    '',
    'https://evil.example/dashboard',
    '//evil.example/dashboard',
    '/login',
    'javascript:alert(1)',
    '/dashboard\\..\\evil',
  ])('rejects %s', (link) => {
    expect(safeAnnouncementLink(link)).toBeNull()
  })
})
