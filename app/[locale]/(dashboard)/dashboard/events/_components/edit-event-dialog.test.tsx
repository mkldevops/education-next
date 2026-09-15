import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateEventAction = vi.fn().mockResolvedValue('OK')

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// Le baril `@peaklab/ui` importe `@/i18n/routing`, qui appelle `next-intl/navigation` —
// non résoluble par Node hors du bundler Next.
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../../_lib/event-actions', () => ({
  updateEventAction: (id: string, input: unknown) => updateEventAction(id, input),
  removeEventImageAction: vi.fn(),
  uploadEventImageAction: vi.fn(),
}))

import { EditEventDialog } from './edit-event-dialog'

const baseEvent = {
  id: 'event-1',
  title: 'Réunion de rentrée',
  summary: null,
  description: null,
  category: 'MEETING' as const,
  visibility: 'MEMBERS' as const,
  status: 'DRAFT' as const,
  location: null,
  announceDaysBefore: null,
  images: [],
}

function openDialog(event: Parameters<typeof EditEventDialog>[0]['event']) {
  render(<EditEventDialog event={event} />)
  fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
}

describe('EditEventDialog allDay toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the stored quantième when toggling an all-day event to timed, for a reader west of Greenwich', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'

    openDialog({
      ...baseEvent,
      allDay: true,
      startAt: new Date('2026-03-10T00:00:00.000Z'),
      endAt: null,
    })

    const startInput = screen.getByLabelText('fields.startAt') as HTMLInputElement
    expect(startInput.value).toBe('2026-03-10')

    fireEvent.click(screen.getByLabelText('fields.allDay'))

    // Avant correctif : la bascule relisait le même instant en composants locaux
    // (America/Los_Angeles), donc 2026-03-09T16:00 — un jour plus tôt que ce qui est stocké.
    expect(startInput.type).toBe('datetime-local')
    expect(startInput.value).toBe('2026-03-10T00:00')

    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })

  it('keeps the stored quantième when toggling a timed event to all-day', () => {
    openDialog({
      ...baseEvent,
      allDay: false,
      startAt: new Date('2026-03-11T01:00:00.000Z'),
      endAt: null,
    })

    const startInput = screen.getByLabelText('fields.startAt') as HTMLInputElement
    expect(startInput.value).toBe('2026-03-11T01:00')

    fireEvent.click(screen.getByLabelText('fields.allDay'))

    expect(startInput.type).toBe('date')
    expect(startInput.value).toBe('2026-03-11')
  })

  it('submits startAt as the exact UTC instant shown, unaffected by the browser timezone', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'Pacific/Honolulu'

    openDialog({
      ...baseEvent,
      allDay: false,
      startAt: new Date('2026-12-03T17:30:00.000Z'),
      endAt: new Date('2026-12-03T19:00:00.000Z'),
    })

    const form = screen.getByLabelText('fields.title').closest('form')
    expect(form).not.toBeNull()
    if (form) fireEvent.submit(form)

    expect(updateEventAction).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        startAt: new Date('2026-12-03T17:30:00.000Z'),
        endAt: new Date('2026-12-03T19:00:00.000Z'),
      })
    )

    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })
})
