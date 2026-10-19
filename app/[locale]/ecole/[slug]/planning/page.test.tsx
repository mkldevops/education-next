import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findBySlugMock = vi.fn()
const periodFindManyMock = vi.fn()
const levelProgressionFindManyMock = vi.fn()
const listPublicClassScheduleMock = vi.fn()
const getBrandingConfigMock = vi.fn()
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
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: unknown; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
  getPathname: ({ href }: { href: string | { pathname: string } }) =>
    typeof href === 'string' ? href : href.pathname,
}))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: { findBySlug: findBySlugMock } }))
vi.mock('@/lib/db', () => ({
  db: {
    period: { findMany: periodFindManyMock },
    levelProgression: { findMany: levelProgressionFindManyMock },
  },
}))
vi.mock('@/use-cases/class-schedules/list-public-class-schedule', () => ({
  listPublicClassSchedule: listPublicClassScheduleMock,
}))
vi.mock('@/lib/branding', () => ({ getBrandingConfig: getBrandingConfigMock }))
vi.mock('@/lib/theme-configs', () => ({ getThemeConfigs: getThemeConfigsMock }))
vi.mock('./_lib/schedule-qr-code', () => ({ buildScheduleQrCode: async () => null }))

const { default: PublicSchedulePage } = await import('./page')

const school = { id: 'school-b', name: 'École B', slug: 'ecole-b', isActive: true }
const period = {
  id: 'period-1',
  name: '2026-2027',
  startAt: new Date('2026-09-01'),
  endAt: new Date('2027-06-30'),
}

function pageProps(slug: string) {
  return {
    params: Promise.resolve({ locale: 'fr', slug }),
    searchParams: Promise.resolve({}),
  }
}

describe('PublicSchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findBySlugMock.mockResolvedValue(school)
    periodFindManyMock.mockResolvedValue([period])
    levelProgressionFindManyMock.mockResolvedValue([])
    listPublicClassScheduleMock.mockResolvedValue({
      school: { id: school.id, name: school.name, slug: school.slug },
      slots: [],
    })
    getBrandingConfigMock.mockResolvedValue({ logoUrl: null, schoolName: school.name })
    getThemeConfigsMock.mockResolvedValue([{ name: 'theme_primary', value: '#b91c1c' }])
  })

  it("applies the theme of the school named by the slug, not the visitor's", async () => {
    const page = await PublicSchedulePage(pageProps('ecole-b'))
    const { container } = render(page)

    expect(getThemeConfigsMock).toHaveBeenCalledWith('school-b')
    const themeStyle = Array.from(container.querySelectorAll('style')).find((style) =>
      style.textContent?.includes('--theme-primary')
    )
    expect(themeStyle?.textContent).toContain('--theme-primary: #b91c1c')
  })

  it('is notFound when the school is unknown, before reading any theme', async () => {
    findBySlugMock.mockResolvedValue(null)

    await expect(PublicSchedulePage(pageProps('unknown'))).rejects.toBeInstanceOf(NotFoundSignal)
    expect(getThemeConfigsMock).not.toHaveBeenCalled()
  })
})
