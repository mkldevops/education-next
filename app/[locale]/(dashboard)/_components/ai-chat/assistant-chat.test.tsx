import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const chat = { messages: [] as UIMessage[] }

vi.mock('@ai-sdk/react', () => ({
  useChat: (options: { messages: UIMessage[] }) => ({
    messages: options.messages.length > 0 ? options.messages : chat.messages,
    status: 'ready',
    error: undefined,
    sendMessage: vi.fn(),
    clearError: vi.fn(),
    stop: vi.fn(async () => {}),
    addToolApprovalResponse: vi.fn(),
  }),
}))
vi.mock('@/i18n/routing', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('next-intl', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
  t.has = () => true
  t.raw = () => []
  return { useTranslations: () => t }
})
vi.mock('./chat-panel', () => ({
  ChatPanel: (props: {
    messages: UIMessage[]
    notice?: ReactNode
    initialText?: string
    composerTools?: ReactNode
  }) => (
    <section>
      <ol>
        {props.messages.map((message) => (
          <li key={message.id}>
            {message.role}:
            {message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')}
          </li>
        ))}
      </ol>
      {props.notice}
      <output aria-label="draft">{props.initialText ?? ''}</output>
      {props.composerTools}
    </section>
  ),
}))
vi.mock('./family-picker', () => ({
  FamilyPicker: (props: { value: { id: string } | null; onChange: (f: unknown) => void }) => (
    <button type="button" onClick={() => props.onChange({ id: 'family-1', name: 'Famille A' })}>
      family:{props.value?.id ?? 'none'}
    </button>
  ),
}))
vi.mock('./conversation-history', () => ({ ConversationHistory: () => null }))

const { AssistantChat } = await import('./assistant-chat')

const say = (role: 'user' | 'assistant', text: string, index: number): UIMessage => ({
  id: `m-${index}`,
  role,
  parts: [{ type: 'text', text }],
})

const heavyConversation = () => [
  ...Array.from({ length: 30 }, (_, index) =>
    say(index % 2 ? 'assistant' : 'user', index === 0 ? 'Inscriptions Chiyoni' : 'x', index)
  ),
  say('user', 'Inscris Yusri', 30),
]

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  chat.messages = heavyConversation()
})

const action = () => screen.getByRole('button', { name: 'chat.compact.action' })

describe('AssistantChat compaction', () => {
  it('offers nothing on a light conversation', () => {
    chat.messages = [say('user', 'Bonjour', 0)]
    render(<AssistantChat model="m" />)

    expect(screen.queryByRole('button', { name: 'chat.compact.action' })).not.toBeInTheDocument()
  })

  it('continues in a seeded conversation, carrying the family and the unanswered question', async () => {
    fetchMock.mockResolvedValue(Response.json({ summary: '- Fait : rien' }))
    render(<AssistantChat model="m" />)
    fireEvent.click(screen.getByRole('button', { name: 'family:none' }))

    fireEvent.click(action())

    expect(await screen.findByText(/assistant:chat.compact.seedHeading/)).toBeInTheDocument()
    expect(
      screen.getByText('user:chat.compact.seedQuestion:{"title":"Inscriptions Chiyoni"}')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('draft')).toHaveTextContent('Inscris Yusri')
    expect(screen.getByRole('button', { name: 'family:family-1' })).toBeInTheDocument()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toHaveLength(30)
  })

  it('keeps the conversation and says so when the summary fails', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'timeout' }, { status: 502 }))
    render(<AssistantChat model="m" />)

    fireEvent.click(action())

    expect(await screen.findByText('chat.compact.failed')).toBeInTheDocument()
    expect(screen.getByText('user:Inscris Yusri')).toBeInTheDocument()
  })

  it('drops a summary that arrives after the admin started a new conversation', async () => {
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((done, fail) => {
          resolve = done
          init.signal?.addEventListener('abort', () =>
            fail(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          )
        })
    )
    render(<AssistantChat model="m" />)
    fireEvent.click(action())

    chat.messages = []
    fireEvent.click(screen.getByRole('button', { name: 'new' }))
    await act(async () => resolve(Response.json({ summary: 'late' })))

    await waitFor(() => expect(screen.queryByText(/seedHeading/)).not.toBeInTheDocument())
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })
})
