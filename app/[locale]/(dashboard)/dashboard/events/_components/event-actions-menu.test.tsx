import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/toast', () => ({ toast, toastActionError: vi.fn() }))
vi.mock('../../../_lib/event-actions', () => ({
  updateEventAction: vi.fn(),
  duplicateEventAction: vi.fn(),
  archiveEventAction: vi.fn(),
  uploadEventImageAction: vi.fn(),
  removeEventImageAction: vi.fn(),
  setEventCoverAction: vi.fn(),
}))

import { EventActionsMenu } from './event-actions-menu'

const baseEvent = {
  id: 'event-1',
  slug: 'kermesse',
  title: 'Kermesse',
  summary: null,
  description: null,
  category: 'CELEBRATION' as const,
  visibility: 'PUBLIC' as const,
  status: 'PUBLISHED' as const,
  allDay: true,
  startAt: new Date('2026-06-20T00:00:00.000Z'),
  endAt: null,
  location: null,
  announceDaysBefore: null,
  images: [],
}

function renderMenu(event = baseEvent) {
  render(<EventActionsMenu event={event} schoolSlug="ecole-centre" nextStartLabel="20 juin 2027" />)
  fireEvent.click(screen.getByRole('button', { name: 'columns.actions' }))
}

describe('EventActionsMenu', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    writeText.mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
  })

  it('gathers every event action in the menu', () => {
    renderMenu()

    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items).toEqual([
      'trigger',
      'trigger',
      'trigger',
      'poster.trigger',
      'publicLink.view',
      'publicLink.copy',
      'archive.trigger',
    ])
  })

  it('opens the public page in a new tab', () => {
    renderMenu()

    const link = screen.getByRole('menuitem', { name: 'publicLink.view' })
    expect(link).toHaveAttribute('href', '/ecole/ecole-centre/evenements/kermesse')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('copies the absolute localized public url', async () => {
    renderMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'publicLink.copy' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('publicLink.copied'))
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/fr/ecole/ecole-centre/evenements/kermesse`
    )
  })

  it('labels a hidden event as a preview and warns that its copied link stays private', async () => {
    renderMenu({ ...baseEvent, status: 'DRAFT' as never })

    expect(screen.getByRole('menuitem', { name: 'publicLink.preview' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'publicLink.copy' }))

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('publicLink.copiedPrivate'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('reports a clipboard failure', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    renderMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'publicLink.copy' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('publicLink.copyFailed'))
  })
})
