import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_ASSISTANT_LIMITS } from '@/domain/ai-assistant'

vi.mock('@/i18n/routing', () => ({ Link: 'a' }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

const { ChatPanel } = await import('./chat-panel')

const onSend = vi.fn()
const onStop = vi.fn()
const onReset = vi.fn()

function renderPanel(props: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      messages={[]}
      status="ready"
      errorMessage={null}
      providerNotice="notice"
      onSend={onSend}
      onStop={onStop}
      onReset={onReset}
      {...props}
    />
  )
}

const fileInput = () => screen.getByLabelText('attach', { selector: 'input' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChatPanel', () => {
  it('keeps the send button disabled until there is text or a photo', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'Fiche' } })

    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled()
  })

  it('sends the text and the attached photos as data URLs', async () => {
    renderPanel()
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'fiche.png', { type: 'image/png' })

    fireEvent.change(fileInput(), { target: { files: [png] } })
    expect(await screen.findByAltText('imageAlt:{"index":1}')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: ' Voici ' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(onSend).toHaveBeenCalledWith('Voici', [
      {
        type: 'file',
        mediaType: 'image/png',
        filename: 'fiche.png',
        url: expect.stringMatching(/^data:image\/png;base64,/),
      },
    ])
    expect(screen.queryByAltText('imageAlt:{"index":1}')).not.toBeInTheDocument()
  })

  it('refuses a file type outside the allowlist before reading it', async () => {
    renderPanel()
    const gif = new File(['x'], 'anim.gif', { type: 'image/gif' })

    fireEvent.change(fileInput(), { target: { files: [gif] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('fileErrors.type')
    expect(screen.queryByAltText('imageAlt:{"index":1}')).not.toBeInTheDocument()
  })

  it('refuses an oversized photo', async () => {
    renderPanel()
    const big = new File([new Uint8Array(8)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: AI_ASSISTANT_LIMITS.maxImageBytes + 1 })

    fireEvent.change(fileInput(), { target: { files: [big] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('fileErrors.size')
  })

  it('bounds the number of photos per message', async () => {
    renderPanel()
    const files = Array.from(
      { length: AI_ASSISTANT_LIMITS.maxImagesPerMessage + 1 },
      (_, i) => new File(['x'], `p${i}.webp`, { type: 'image/webp' })
    )

    fireEvent.change(fileInput(), { target: { files } })

    expect(await screen.findByRole('alert')).toHaveTextContent('fileErrors.count')
  })

  it('offers stop while streaming and reset once a conversation exists', () => {
    const { rerender } = renderPanel({ status: 'streaming' })

    fireEvent.click(screen.getByRole('button', { name: 'stop' }))
    expect(onStop).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'send' })).not.toBeInTheDocument()

    rerender(
      <ChatPanel
        messages={[{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Bonjour' }] }]}
        status="ready"
        errorMessage={null}
        providerNotice="notice"
        onSend={onSend}
        onStop={onStop}
        onReset={onReset}
      />
    )

    expect(screen.getByText('Bonjour')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'reset' }))
    expect(onReset).toHaveBeenCalled()
  })

  it('flags a received proposal in the thread and surfaces the error', async () => {
    renderPanel({
      errorMessage: 'boom',
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-propose_enrollment',
              toolCallId: 'c1',
              state: 'output-available',
              input: {},
              output: { status: 'proposed' },
            },
          ],
        },
      ],
    })

    expect(screen.getByText('proposalReceived')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
  })
})
