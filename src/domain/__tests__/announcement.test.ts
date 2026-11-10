import { describe, expect, it } from 'vitest'
import {
  type Announcement,
  type AnnouncementReader,
  countUnreadAnnouncements,
  isAnnouncementVisible,
  resolvePopupAnnouncements,
  safeAnnouncementLink,
  visibleAnnouncements,
} from '@/domain/announcement'

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    publishedAt: new Date('2026-10-10T10:00:00Z'),
    expiresAt: null,
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
  roles: ['PARENT'],
  isSuperAdmin: false,
  seenAt: new Date('2026-10-01T00:00:00Z'),
}

const now = new Date('2026-10-15T00:00:00Z')

describe('isAnnouncementVisible', () => {
  it('shows an announcement to a role in its audience', () => {
    expect(isAnnouncementVisible(announcement(), parent)).toBe(true)
  })

  it('hides an announcement from a role outside its audience', () => {
    expect(isAnnouncementVisible(announcement({ audience: ['ADMIN'] }), parent)).toBe(false)
  })

  it('hides every announcement from a reader without a school role', () => {
    expect(isAnnouncementVisible(announcement(), { ...parent, roles: [] })).toBe(false)
  })

  it('shows every announcement to a super-admin, empty audience included', () => {
    const superAdmin = { ...parent, roles: [], isSuperAdmin: true }
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

    expect(countUnreadAnnouncements(items, parent, now)).toBe(1)
  })

  it('ignores an expired announcement', () => {
    const items = [announcement({ expiresAt: new Date('2026-10-12T00:00:00Z') })]

    expect(countUnreadAnnouncements(items, parent, now)).toBe(0)
  })
})

describe('resolvePopupAnnouncements', () => {
  it('returns every unread highlighted announcement, newest first', () => {
    const items = [
      announcement({ id: 'plain', publishedAt: new Date('2026-10-14T00:00:00Z') }),
      announcement({ id: 'older', highlight: true }),
      announcement({
        id: 'latest',
        highlight: true,
        publishedAt: new Date('2026-10-12T00:00:00Z'),
      }),
    ]

    expect(resolvePopupAnnouncements(items, parent, { now }).map((a) => a.id)).toEqual([
      'latest',
      'older',
    ])
  })

  it('caps the number of announcements', () => {
    const items = Array.from({ length: 4 }, (_, index) =>
      announcement({
        id: `a${index}`,
        highlight: true,
        publishedAt: new Date(`2026-10-1${index}T00:00:00Z`),
      })
    )

    expect(resolvePopupAnnouncements(items, parent, { now, limit: 2 }).map((a) => a.id)).toEqual([
      'a3',
      'a2',
    ])
  })

  it('expires 15 days after publication by default', () => {
    const items = [announcement({ highlight: true })]

    expect(resolvePopupAnnouncements(items, parent, { now })).toHaveLength(1)
    expect(
      resolvePopupAnnouncements(items, parent, { now: new Date('2026-10-25T10:00:01Z') })
    ).toEqual([])
  })

  it('follows the expiry date set in the CMS', () => {
    const items = [announcement({ highlight: true, expiresAt: new Date('2026-11-30T00:00:00Z') })]

    expect(
      resolvePopupAnnouncements(items, parent, { now: new Date('2026-11-20T00:00:00Z') })
    ).toHaveLength(1)
    expect(
      resolvePopupAnnouncements(items, parent, { now: new Date('2026-12-01T00:00:00Z') })
    ).toEqual([])
  })

  it('returns nothing once the highlighted announcement has been seen', () => {
    const reader = { ...parent, seenAt: new Date('2026-10-11T00:00:00Z') }

    expect(resolvePopupAnnouncements([announcement({ highlight: true })], reader, { now })).toEqual(
      []
    )
  })

  it('ignores a highlighted announcement outside the reader audience', () => {
    const items = [announcement({ highlight: true, audience: ['ADMIN'] })]

    expect(resolvePopupAnnouncements(items, parent, { now })).toEqual([])
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
