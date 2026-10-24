import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const previewMock = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    `${key} ${JSON.stringify(values)}`,
}))
vi.mock('../../../_lib/event-actions', () => ({
  previewClosureMealImpactAction: (input: unknown) => previewMock(input),
}))

import { ClosureMealImpact } from './closure-meal-impact'

describe('ClosureMealImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    previewMock.mockResolvedValue({ children: 3, moved: 1 })
  })

  it('previews the meals touched by a closure, edited event excluded', async () => {
    render(<ClosureMealImpact eventId="event-1" category="CLOSURE" startAt="2026-11-04" endAt="" />)

    expect(await screen.findByRole('status')).toHaveTextContent('{"children":3,"moved":1}')
    expect(previewMock).toHaveBeenCalledWith({
      eventId: 'event-1',
      startAt: expect.any(Date),
      endAt: null,
    })
  })

  it('stays silent for an event that does not close the school', async () => {
    render(<ClosureMealImpact category="OUTING" startAt="2026-11-04" endAt="" />)

    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(previewMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows nothing when the school has no meals', async () => {
    previewMock.mockResolvedValue(null)
    render(<ClosureMealImpact category="HOLIDAY" startAt="2026-11-04" endAt="2026-11-08" />)

    await waitFor(() => expect(previewMock).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
