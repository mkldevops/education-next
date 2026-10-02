import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_ASSISTANT_LIMITS } from '@/domain/ai-assistant'

vi.mock('@/i18n/routing', () => ({ Link: 'a' }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  useLocale: () => 'fr',
}))

const { ChatPanel } = await import('./chat-panel')

const onSend = vi.fn()
const onStop = vi.fn()
const onReset = vi.fn()

function renderPanel(props: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      namespace="chat"
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

  it('attaches a screenshot pasted from the clipboard', async () => {
    renderPanel()
    const shot = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' })

    fireEvent.paste(screen.getByPlaceholderText('placeholder'), {
      clipboardData: { files: [shot] },
    })
    expect(await screen.findByAltText('imageAlt:{"index":1}')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(onSend).toHaveBeenCalledWith('', [
      expect.objectContaining({
        mediaType: 'image/png',
        filename: expect.stringMatching(/^capture-.*\.png$/),
      }),
    ])
  })

  it('accepts a PDF dropped on the panel', async () => {
    renderPanel()
    const pdf = new File(['%PDF-1.7'], 'liste.pdf', { type: 'application/pdf' })

    fireEvent.drop(screen.getByPlaceholderText('placeholder'), {
      dataTransfer: { types: ['Files'], files: [pdf] },
    })

    expect(await screen.findByText('liste.pdf')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    expect(onSend).toHaveBeenCalledWith('', [
      expect.objectContaining({ mediaType: 'application/pdf', filename: 'liste.pdf' }),
    ])
  })

  it('places a suggestion in the input without sending it', () => {
    renderPanel({ suggestions: ['Quelles classes ?'] })

    fireEvent.click(screen.getByRole('button', { name: 'Quelles classes ?' }))

    expect(screen.getByPlaceholderText('placeholder')).toHaveValue('Quelles classes ?')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('offers stop while streaming and reset once a conversation exists', () => {
    const { rerender } = renderPanel({ status: 'streaming' })

    fireEvent.click(screen.getByRole('button', { name: 'stop' }))
    expect(onStop).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'send' })).not.toBeInTheDocument()

    rerender(
      <ChatPanel
        namespace="chat"
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
      renderPart: (part, key) =>
        part.type === 'tool-propose_enrollment' ? <p key={key}>proposalReceived</p> : null,
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

  it('sends on Enter and keeps Shift+Enter for a new line', () => {
    renderPanel()
    const textarea = screen.getByPlaceholderText('placeholder')

    fireEvent.change(textarea, { target: { value: 'Bonjour' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('Bonjour', [])
  })

  it('gives the focus back to the input when a turn ends', () => {
    const { rerender } = renderPanel({ status: 'streaming' })
    const input = screen.getByPlaceholderText('placeholder')
    expect(input).not.toHaveFocus()

    rerender(
      <ChatPanel
        namespace="chat"
        messages={[]}
        status="ready"
        errorMessage={null}
        providerNotice="notice"
        onSend={onSend}
        onStop={onStop}
        onReset={onReset}
      />
    )

    expect(input).toHaveFocus()
  })

  it('hides dictation when the browser has no speech recognition', () => {
    renderPanel()

    expect(screen.queryByRole('button', { name: 'dictation.start' })).not.toBeInTheDocument()
  })

  it('appends the dictated text to the draft without sending it', () => {
    const instances: FakeRecognition[] = []
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = true
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn(() => this.onend?.())
      abort = vi.fn()
      constructor() {
        instances.push(this)
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    try {
      renderPanel()
      fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'Bonjour' } })
      fireEvent.click(screen.getByRole('button', { name: 'dictation.start' }))

      const recognition = instances[0]
      expect(recognition.lang).toBe('fr-FR')
      expect(screen.getByText('dictation.listening')).toBeInTheDocument()
      act(() => {
        recognition.onresult?.({
          resultIndex: 0,
          results: [Object.assign([{ transcript: 'paiement pour' }], { isFinal: false })],
        })
      })
      expect(screen.getByText('paiement pour…')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('placeholder')).toHaveValue('Bonjour')
      act(() => {
        recognition.onresult?.({
          resultIndex: 0,
          results: [Object.assign([{ transcript: ' paiement pour Adam ' }], { isFinal: true })],
        })
      })

      expect(screen.getByPlaceholderText('placeholder')).toHaveValue('Bonjour paiement pour Adam')
      expect(onSend).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'dictation.stop' }))
      expect(screen.getByRole('button', { name: 'dictation.start' })).toBeInTheDocument()
      expect(screen.queryByText('dictation.listening')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
