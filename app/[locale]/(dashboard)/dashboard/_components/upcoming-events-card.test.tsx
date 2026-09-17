import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const listUpcomingEvents = vi.fn()

vi.mock('@/use-cases/events/list-upcoming-events', () => ({ listUpcomingEvents }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img alt={alt} {...props} />
  ),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

const { UpcomingEventsCard } = await import('./upcoming-events-card')

describe('UpcomingEventsCard', () => {
  it('renders the event cover image when one exists', async () => {
    listUpcomingEvents.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Fête de l’école',
        category: 'CELEBRATION',
        status: 'PUBLISHED',
        allDay: true,
        startAt: new Date('2027-01-04T00:00:00.000Z'),
        endAt: null,
        images: [{ storageKey: 'events/school/cover.webp', alt: 'Affiche de la fête' }],
      },
    ])

    render(
      await UpcomingEventsCard({
        schoolId: 'school-1',
        viewer: 'STAFF',
        locale: 'fr',
        canManage: true,
      })
    )

    expect(screen.getByRole('img', { name: 'Affiche de la fête' })).toHaveAttribute(
      'src',
      '/api/media/events/school/cover.webp'
    )
  })
})
