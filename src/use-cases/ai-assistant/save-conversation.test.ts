import type { UIMessage } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/gateways/ai-conversation-gateway', () => ({ aiConversationGateway: {} }))

const { conversationTitle, saveConversation, withoutImages } = await import('./save-conversation')

const scope = { schoolId: 'school-1', userId: 'user-1' }
const id = '11111111-1111-4111-8111-111111111111'

const messages: UIMessage[] = [
  {
    id: 'a',
    role: 'user',
    parts: [
      { type: 'text', text: '  Inscris   la famille\nMadi ' },
      {
        type: 'file',
        mediaType: 'image/webp',
        filename: 'fiche.png',
        url: 'data:image/webp;base64,AA',
      },
    ],
  },
  { id: 'b', role: 'assistant', parts: [{ type: 'text', text: 'Je regarde.' }] },
]

describe('saveConversation', () => {
  it('stores the conversation without the photos, titled after the first request', async () => {
    const save = vi.fn()

    expect(await saveConversation(scope, id, messages, { save } as never)).toBe('OK')

    const [, , savedId, data] = save.mock.calls[0]
    expect(savedId).toBe(id)
    expect(data.title).toBe('Inscris la famille Madi')
    expect(JSON.stringify(data.messages)).not.toContain('base64')
    expect(data.messages[0].parts[1]).toEqual({ type: 'text', text: '[photo: fiche.png]' })
  })

  it('ignores a conversation id that is not a uuid', async () => {
    const save = vi.fn()

    expect(await saveConversation(scope, 'abc', messages, { save } as never)).toBe('invalidId')
    expect(save).not.toHaveBeenCalled()
  })

  it('reports a failed write without throwing', async () => {
    const save = vi.fn().mockRejectedValue(new Error('unique'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await saveConversation(scope, id, messages, { save } as never)).toBe('saveFailed')
  })
})

describe('conversationTitle', () => {
  it('falls back to a photo marker and truncates long requests', () => {
    expect(
      conversationTitle(withoutImages([{ ...messages[0], parts: [messages[0].parts[1]] }]))
    ).toBe('[photo: fiche.png]')
    expect(conversationTitle([])).toBe('[photo]')
    const long = conversationTitle([
      { id: 'x', role: 'user', parts: [{ type: 'text', text: 'a'.repeat(200) }] },
    ])
    expect(long).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
  })
})
