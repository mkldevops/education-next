import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantBriefing } from '@/use-cases/ai-assistant/assistant-briefing'

const listAiConversations = vi.fn()
const loadAiConversation = vi.fn()

vi.mock('../../_lib/ai-conversation-actions', () => ({ listAiConversations, loadAiConversation }))
vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string
    children: ReactNode
    className: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next-intl', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
  return {
    useTranslations: () => t,
    useLocale: () => 'fr',
    useFormatter: () => ({ relativeTime: () => 'il y a 2 h' }),
  }
})

const { AssistantWelcome } = await import('./assistant-welcome')

const EMPTY: AssistantBriefing = { overdue: null, openCalls: null, pendingEnrollments: null }

async function renderWelcome(briefing: AssistantBriefing, overrides = {}) {
  const props = {
    briefing: Promise.resolve(briefing),
    currency: 'EUR',
    composer: <textarea aria-label="composer" />,
    suggestions: ['Inscrire une famille'],
    onPick: vi.fn(),
    onOpen: vi.fn(),
    onShowHistory: vi.fn(),
    ...overrides,
  }
  await act(async () => {
    render(<AssistantWelcome {...props} />)
  })
  return props
}

describe('AssistantWelcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAiConversations.mockResolvedValue([])
  })

  it('turns each pending task into a card that only fills the composer', async () => {
    const props = await renderWelcome({
      overdue: { families: 3, amount: 450 },
      openCalls: { count: 2, classes: ['6e B', 'CM2 A'] },
      pendingEnrollments: 4,
    })

    expect(screen.getByLabelText('composer')).toBeInTheDocument()
    fireEvent.click(await screen.findByText('overdue.title:{"count":3}'))
    expect(props.onPick).toHaveBeenCalledWith('overdue.prompt')
    expect(screen.getByText('6e B, CM2 A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('calls.title:{"count":2}'))
    expect(props.onPick).toHaveBeenLastCalledWith('calls.prompt')
    expect(screen.getByText('enrollments.title:{"count":4}').closest('a')).toHaveAttribute(
      'href',
      '/dashboard/enrollments'
    )
    expect(screen.queryByText('none')).not.toBeInTheDocument()
  })

  it('falls back to the suggestions when nothing is pending', async () => {
    const props = await renderWelcome({
      overdue: { families: 0, amount: 0 },
      openCalls: { count: 0, classes: [] },
      pendingEnrollments: 0,
    })

    fireEvent.click(await screen.findByText('Inscrire une famille'))
    expect(screen.getByText('none')).toBeInTheDocument()
    expect(props.onPick).toHaveBeenCalledWith('Inscrire une famille')
  })

  it('shows the last three conversations and opens one', async () => {
    listAiConversations.mockResolvedValue(
      ['a', 'b', 'c', 'd'].map((id) => ({ id, title: `Conv ${id}`, updatedAt: new Date() }))
    )
    loadAiConversation.mockResolvedValue({ id: 'b', messages: [] })
    const props = await renderWelcome(EMPTY)

    fireEvent.click(await screen.findByText('Conv b'))
    expect(screen.queryByText('Conv d')).not.toBeInTheDocument()
    await waitFor(() => expect(props.onOpen).toHaveBeenCalledWith({ id: 'b', messages: [] }))
    fireEvent.click(screen.getByText('all'))
    expect(props.onShowHistory).toHaveBeenCalled()
  })

  it('hides the recent section when there is no saved conversation', async () => {
    await renderWelcome(EMPTY)
    await screen.findByText('none')
    expect(screen.queryByText('title')).toBeInTheDocument()
    expect(screen.queryByText('all')).not.toBeInTheDocument()
  })
})
