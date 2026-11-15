import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPublicEventsMock = vi.fn()
const getThemeConfigsMock = vi.fn()
const getDefaultPeriodMock = vi.fn()
const getBrandingConfigMock = vi.fn()
const sheetMock = vi.fn()

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
}))
vi.mock('@/use-cases/events/list-public-events', () => ({
  listPublicEvents: listPublicEventsMock,
}))
vi.mock('@/lib/theme-configs', () => ({ getThemeConfigs: getThemeConfigsMock }))
vi.mock('@/lib/branding', () => ({ getBrandingConfig: getBrandingConfigMock }))
vi.mock('@/features/dashboard/period', () => ({ getDefaultPeriod: getDefaultPeriodMock }))
vi.mock('@/features/events', () => ({
  EVENTS_CALENDAR_PRINT_CSS: '',
  EventsCalendarSheet: (props: { months: { weeks: unknown[][] }[] }) => {
    sheetMock(props)
    return null
  },
}))
vi.mock('../../../(print)/_components/print-button', () => ({ PrintButton: () => null }))

const { default: PublicEventsCalendarPage } = await import('./page')

const school = { id: 'school-b', name: 'École B', slug: 'ecole-b' }
const period = {
  id: 'period-1',
  name: '2026-2027',
  startAt: new Date('2026-09-01T00:00:00.000Z'),
  endAt: new Date('2027-07-04T00:00:00.000Z'),
}

function event(id: string, status: string) {
  return {
    id,
    title: id,
    category: 'MEETING',
    status,
    startAt: new Date('2026-09-10T00:00:00.000Z'),
    endAt: null,
  }
}

describe('PublicEventsCalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicEventsMock.mockResolvedValue({
      school,
      events: [event('kept', 'PUBLISHED'), event('dropped', 'CANCELLED')],
    })
    getThemeConfigsMock.mockResolvedValue([])
    getBrandingConfigMock.mockResolvedValue({ logoUrl: null, schoolName: 'École B' })
    getDefaultPeriodMock.mockResolvedValue(period)
  })

  it("reads the slug school's data and leaves cancelled events out of the sheet", async () => {
    render(
      await PublicEventsCalendarPage({
        params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }),
      })
    )

    expect(listPublicEventsMock).toHaveBeenCalledWith('ecole-b')
    expect(getBrandingConfigMock).toHaveBeenCalledWith('school-b')
    expect(getDefaultPeriodMock).toHaveBeenCalledWith('school-b')
    const [[{ months }]] = sheetMock.mock.calls as [
      [
        {
          months: { weeks: ({ day: number; titles: string[] } | null)[][] }[]
        },
      ],
    ]
    const tenth = months[0]?.weeks.flat().find((day) => day?.day === 10)
    expect(tenth?.titles).toEqual(['kept'])
  })

  it('is notFound when the school is unknown or has events disabled', async () => {
    listPublicEventsMock.mockResolvedValue('notConfigured')

    await expect(
      PublicEventsCalendarPage({ params: Promise.resolve({ locale: 'fr', slug: 'ecole-b' }) })
    ).rejects.toBeInstanceOf(NotFoundSignal)
    expect(getBrandingConfigMock).not.toHaveBeenCalled()
  })
})
