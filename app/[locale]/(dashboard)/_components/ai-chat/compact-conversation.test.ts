import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { AI_ASSISTANT_LIMITS } from '@/domain/ai-assistant'
import { normalizeChatMessages } from '@/use-cases/ai-assistant/normalize-chat-messages'
import { compactOffer, compactRequest, compactSeed, compactTitle } from './compact-conversation'

const message = (role: 'user' | 'assistant', parts: UIMessage['parts']): UIMessage => ({
  id: crypto.randomUUID(),
  role,
  parts,
})
const say = (role: 'user' | 'assistant', text: string) => message(role, [{ type: 'text', text }])

describe('compactOffer', () => {
  it('offers nothing for an empty or light conversation', () => {
    expect(compactOffer([], 'tooManyMessages')).toBeNull()
    expect(compactOffer([say('user', 'Bonjour')], null)).toBeNull()
  })

  it('warns near the message limit and blocks on a limit refusal', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      say(index % 2 ? 'assistant' : 'user', 'x')
    )
    expect(compactOffer(many, null)).toBe('heavy')
    expect(compactOffer([say('user', 'x')], 'tooManyMessages')).toBe('blocked')
    expect(compactOffer([say('user', 'x')], 'tooManyImages')).toBe('blocked')
  })

  it('blames a too-long refusal on history only when tool results fill the budget', () => {
    expect(compactOffer([say('user', 'x')], 'messageTooLong')).toBeNull()
    const heavyTool = message('assistant', [
      {
        type: 'tool-list_families',
        toolCallId: 'c1',
        state: 'output-available',
        input: {},
        output: 'y'.repeat(50_000),
      },
    ])
    expect(compactOffer([say('user', 'x'), heavyTool], 'messageTooLong')).toBe('blocked')
  })
})

describe('compactRequest', () => {
  it('keeps the unanswered question as draft and strips attachment data', () => {
    const request = compactRequest([
      message('user', [
        { type: 'text', text: 'Voici la fiche' },
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'fiche.png',
          url: 'data:image/png;base64,AAA',
        },
      ]),
      say('assistant', 'Reçu'),
      say('user', 'Inscris Yusri'),
    ])

    expect(request.draft).toBe('Inscris Yusri')
    expect(request.messages).toHaveLength(2)
    expect(request.messages[0].parts[1]).toEqual({ type: 'file', filename: 'fiche.png' })
  })

  it('has no draft when the conversation ends on an answer', () => {
    expect(compactRequest([say('user', 'a'), say('assistant', 'b')]).draft).toBe('')
  })
})

describe('compactTitle', () => {
  it('takes the first question, shortened', () => {
    expect(compactTitle([say('assistant', 'x'), say('user', '  Liste   des classes ')])).toBe(
      'Liste des classes'
    )
    expect(compactTitle([say('user', 'a'.repeat(100))])).toHaveLength(60)
  })
})

describe('compactSeed', () => {
  it('starts with a question and fits the per-message text limit', () => {
    const seed = compactSeed('Suite', 'Résumé :', 's'.repeat(20_000))

    expect(seed.map(({ role }) => role)).toEqual(['user', 'assistant'])
    const answer = seed[1].parts[0]
    expect(answer.type === 'text' && answer.text.length).toBe(AI_ASSISTANT_LIMITS.maxTextChars)
  })

  it('is accepted by the chat route once the admin asks the next question', async () => {
    const seed = compactSeed('Suite de « Inscriptions »', 'Résumé :', '- Fait : rien')
    const result = await normalizeChatMessages(
      { messages: [...seed, say('user', 'On continue ?')] },
      async () => {
        throw new Error('no image expected')
      },
      { toolNames: new Set() }
    )

    expect(result.status).toBe('OK')
  })
})
