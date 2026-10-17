import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAnnouncements } from '@/gateways/announcement-gateway'

const fetchMock = vi.fn()

function directusItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    published_at: '2026-10-10T10:00:00.000Z',
    highlight: true,
    audience: ['ADMIN', 'PARENT', 'GUEST'],
    link: '/dashboard/events',
    image: 'file-1',
    translations: [
      {
        languages_code: 'fr',
        title: 'Titre',
        summary: 'Résumé',
        body: '**Corps**',
        video: 'video-fr',
      },
      { languages_code: 'en', title: 'Title', summary: null, body: null, video: 'video-en' },
    ],
    ...overrides,
  }
}

function respondWith(body: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('DIRECTUS_URL', 'https://cms.example.test/')
  vi.stubEnv('DIRECTUS_TOKEN', 'token')
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('listAnnouncements', () => {
  it('maps a Directus item to an announcement in the requested locale', async () => {
    respondWith({ data: [directusItem()] })

    const [announcement] = await listAnnouncements('en')

    expect(announcement).toEqual({
      id: 'a1',
      publishedAt: new Date('2026-10-10T10:00:00.000Z'),
      highlight: true,
      audience: ['ADMIN', 'PARENT'],
      link: '/dashboard/events',
      imageUrl: 'https://cms.example.test/assets/file-1',
      videoUrl: 'https://cms.example.test/assets/video-en',
      title: 'Title',
      summary: null,
      body: null,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/cms\.example\.test\/items\/announcements\?/),
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
    )
  })

  it('falls back to French when the locale has no translation', async () => {
    respondWith({
      data: [directusItem({ translations: [{ languages_code: 'fr', title: 'Titre' }] })],
    })

    const [announcement] = await listAnnouncements('en')

    expect(announcement?.title).toBe('Titre')
    expect(announcement?.videoUrl).toBeNull()
  })

  it('drops items without translation, publication date or expected shape', async () => {
    respondWith({
      data: [
        directusItem({ id: 'no-translation', translations: [] }),
        directusItem({ id: 'no-date', published_at: null }),
        { id: 42 },
        directusItem({ id: 'kept' }),
      ],
    })

    const announcements = await listAnnouncements('fr')

    expect(announcements.map((a) => a.id)).toEqual(['kept'])
  })

  it('returns nothing without configuration and never calls Directus', async () => {
    vi.stubEnv('DIRECTUS_TOKEN', '')

    expect(await listAnnouncements('fr')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns nothing when Directus answers with an error status', async () => {
    respondWith({ errors: [] }, false)

    expect(await listAnnouncements('fr')).toEqual([])
  })

  it('returns nothing when Directus is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))

    expect(await listAnnouncements('fr')).toEqual([])
  })
})
