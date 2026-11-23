import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPublicEventsMock = vi.fn()
const getThemeConfigsMock = vi.fn()
const getDefaultPeriodMock = vi.fn()

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
vi.mock('@/features/dashboard/period', () => ({ getDefaultPeriod: getDefaultPeriodMock }))
vi.mock('@/features/enums', () => ({
  EventCategoryLabel: () => null,
  EventStatusBadge: () => null,
}))
vi.mock('@/features/events', () => ({
  EventsOverviewCalendar: () => <div data-testid="overview" />,
}))

const { default: PublicEventsPage } = await import('./page')

const school = { id: 'school-b', name: 'École B', slug: 'ecole-b' }

const period = {
  id: 'period-1',
  name: '2026-2027',
  startAt: new Date('2026-09-01T00:00:00.000Z'),
  endAt: new Date('2027-07-04T00:00:00.000Z'),
}

function publicEvent(id: string, title: string, startAt: string) {
  return {
    id,
    title,
    category: 'MEETING',
    status: 'PUBLISHED',
    startAt: new Date(`${startAt}T00:00:00.000Z`),
    endAt: null,
    allDay: true,
    location: null,
    summary: null,
    images: [],
  }
}

describe('PublicEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicEventsMock.mockResolvedValue({ school, events: [] })
    getThemeConfigsMock.mockResolvedValue([{ name: 'theme_primary', value: '#b91c1c' }])
    getDefaultPeriodMock.mockResolvedValue(null)
  })

  it("applies the theme of the school named by the slug, not the visitor's", async () => {
    const page = await PublicEventsPage({
      params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }),
    })
    const { container } = render(page)

    expect(getThemeConfigsMock).toHaveBeenCalledWith('school-b')
    expect(getDefaultPeriodMock).toHaveBeenCalledWith('school-b')
    expect(container.querySelector('style')?.textContent).toContain('--theme-primary: #b91c1c')
  })

  it('is notFound when the school is unknown, before reading any theme', async () => {
    listPublicEventsMock.mockResolvedValue('notFound')

    await expect(
      PublicEventsPage({ params: Promise.resolve({ locale: 'fr', slug: 'unknown' }) })
    ).rejects.toBeInstanceOf(NotFoundSignal)
    expect(getThemeConfigsMock).not.toHaveBeenCalled()
  })

  describe('with a current school year', () => {
    beforeEach(() => {
      getDefaultPeriodMock.mockResolvedValue(period)
      listPublicEventsMock.mockResolvedValue({
        school,
        events: [
          publicEvent('old', 'Kermesse 2025', '2025-06-20'),
          publicEvent('now', 'Réunion de rentrée', '2026-09-10'),
        ],
      })
    })

    it('lists the current year only, anchors each event and links past years to the archives', async () => {
      const page = await PublicEventsPage({
        params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }),
      })
      const { container, queryByText, getByTestId } = render(page)

      expect(queryByText('Réunion de rentrée')).not.toBeNull()
      expect(queryByText('Kermesse 2025')).toBeNull()
      expect(container.querySelector('#event-now')).not.toBeNull()
      expect(getByTestId('overview')).not.toBeNull()
      expect(
        container.querySelector('a[href="/ecole/ecole-b/evenements?archives=1"]')
      ).not.toBeNull()
      expect(container.querySelector('a[href="/ecole/ecole-b/calendrier"]')).not.toBeNull()
    })

    it('shows only past years under ?archives=1, without the overview', async () => {
      const page = await PublicEventsPage({
        params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }),
        searchParams: Promise.resolve({ archives: '1' }),
      })
      const { queryByText, queryByTestId } = render(page)

      expect(queryByText('Kermesse 2025')).not.toBeNull()
      expect(queryByText('Réunion de rentrée')).toBeNull()
      expect(queryByTestId('overview')).toBeNull()
    })
  })
})
