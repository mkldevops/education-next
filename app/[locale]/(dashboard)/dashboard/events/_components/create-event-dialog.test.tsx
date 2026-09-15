import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createEventAction = vi.fn().mockResolvedValue('OK')

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// Le baril `@peaklab/ui` importe `@/i18n/routing`, qui appelle `next-intl/navigation` —
// non résoluble par Node hors du bundler Next.
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../../_lib/event-actions', () => ({
  createEventAction: (input: unknown) => createEventAction(input),
}))

import { CreateEventDialog } from './create-event-dialog'

function openDialog() {
  render(<CreateEventDialog />)
  fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
}

describe('CreateEventDialog allDay toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('switches the start/end inputs to datetime-local without losing a value already typed', () => {
    openDialog()

    const startInput = screen.getByLabelText('fields.startAt') as HTMLInputElement
    fireEvent.change(startInput, { target: { value: '2026-12-03' } })
    expect(startInput.type).toBe('date')

    fireEvent.click(screen.getByLabelText('fields.allDay'))

    expect(startInput.type).toBe('datetime-local')
    // La bascule ne doit ni vider le champ ni changer le quantième saisi : seule l'heure
    // (00:00) est ajoutée, le 3 décembre reste le 3 décembre.
    expect(startInput.value).toBe('2026-12-03T00:00')
  })

  it('keeps the same UTC quantième when toggling back to all-day after entering a time', () => {
    openDialog()

    fireEvent.click(screen.getByLabelText('fields.allDay'))
    const startInput = screen.getByLabelText('fields.startAt') as HTMLInputElement
    fireEvent.change(startInput, { target: { value: '2026-12-03T23:30' } })

    fireEvent.click(screen.getByLabelText('fields.allDay'))

    expect(startInput.type).toBe('date')
    expect(startInput.value).toBe('2026-12-03')
  })

  it('submits startAt/endAt as the exact UTC instant typed, not shifted by the browser timezone', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'

    openDialog()
    fireEvent.click(screen.getByLabelText('fields.allDay'))
    fireEvent.change(screen.getByLabelText('fields.startAt'), {
      target: { value: '2026-12-03T17:30' },
    })
    fireEvent.change(screen.getByLabelText('fields.endAt'), {
      target: { value: '2026-12-03T19:00' },
    })
    fireEvent.change(screen.getByLabelText('fields.title'), { target: { value: 'Réunion' } })

    const form = screen.getByLabelText('fields.title').closest('form')
    expect(form).not.toBeNull()
    if (form) fireEvent.submit(form)

    expect(createEventAction).toHaveBeenCalledWith(
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
