import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPublicEventsMock = vi.fn()
const getThemeConfigsMock = vi.fn()

class NotFoundSignal extends Error {
  constructor() {
    super('notFound')
  }
}

vi.mock('next/server', () => ({ connection: async () => undefined }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundSignal()
  },
}))
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async () => (key: string) => key,
}))
// `next-intl/navigation` charge `next/navigation` par une spécification que Node ne
// résout pas hors du bundler Next ; rien ici n'est une lecture de données.
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: unknown; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}))
vi.mock('@/use-cases/events/list-public-events', () => ({
  listPublicEvents: listPublicEventsMock,
}))
vi.mock('@/lib/theme-configs', () => ({ getThemeConfigs: getThemeConfigsMock }))

const { default: PublicEventsPage } = await import('./page')

const school = { id: 'school-b', name: 'École B', slug: 'ecole-b' }

describe('PublicEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicEventsMock.mockResolvedValue({ school, events: [] })
    getThemeConfigsMock.mockResolvedValue([{ name: 'theme_primary', value: '#b91c1c' }])
  })

  it("applies the theme of the school named by the slug, not the visitor's", async () => {
    const page = await PublicEventsPage({
      params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }),
    })
    const { container } = render(page)

    expect(getThemeConfigsMock).toHaveBeenCalledWith('school-b')
    expect(container.querySelector('style')?.textContent).toContain('--theme-primary: #b91c1c')
  })

  it('is notFound when the school is unknown, before reading any theme', async () => {
    listPublicEventsMock.mockResolvedValue('notFound')

    await expect(
      PublicEventsPage({ params: Promise.resolve({ locale: 'fr', slug: 'unknown' }) })
    ).rejects.toBeInstanceOf(NotFoundSignal)
    expect(getThemeConfigsMock).not.toHaveBeenCalled()
  })
})
