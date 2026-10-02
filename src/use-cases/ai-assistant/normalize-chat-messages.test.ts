import { describe, expect, it, vi } from 'vitest'
import { AI_ASSISTANT_LIMITS } from '@/domain/ai-assistant'
import { normalizeChatMessages } from './normalize-chat-messages'
import type { ImageSanitizer } from './sanitize-image'

const okSanitizer: ImageSanitizer = async () => ({
  status: 'OK' as const,
  dataUrl: 'data:image/webp;base64,c2FuaXRpemVk',
  width: 10,
  height: 10,
})

const png = (bytes = 'iVBORw0KGgo=') => `data:image/png;base64,${bytes}`

const user = (parts: unknown[]) => ({ role: 'user', parts })
const assistant = (parts: unknown[]) => ({ role: 'assistant', parts })

describe('normalizeChatMessages', () => {
  it('keeps a sane client message id and replaces any other', async () => {
    const result = await normalizeChatMessages(
      {
        messages: [
          { ...user([{ type: 'text', text: 'Bonjour' }]), id: 'Xy_12-ab' },
          { role: 'assistant', id: 'bad id <script>', parts: [{ type: 'text', text: 'Oui ?' }] },
          { ...user([{ type: 'text', text: 'Merci' }]), id: 'z'.repeat(65) },
        ],
      },
      okSanitizer
    )

    expect(result.status === 'OK' && result.messages.map((message) => message.id)).toEqual([
      'Xy_12-ab',
      'm1',
      'm2',
    ])
  })

  it('rejects anything that is not a non-empty message list ending with the user', async () => {
    expect(await normalizeChatMessages(null, okSanitizer)).toEqual({ status: 'invalidRequest' })
    expect(await normalizeChatMessages({}, okSanitizer)).toEqual({ status: 'invalidRequest' })
    expect(await normalizeChatMessages({ messages: [] }, okSanitizer)).toEqual({
      status: 'invalidRequest',
    })
    expect(
      await normalizeChatMessages(
        {
          messages: [user([{ type: 'text', text: 'a' }]), assistant([{ type: 'text', text: 'b' }])],
        },
        okSanitizer
      )
    ).toEqual({ status: 'invalidRequest' })
    expect(
      await normalizeChatMessages({ messages: [{ role: 'system', parts: [] }] }, okSanitizer)
    ).toEqual({ status: 'invalidRequest' })
  })

  it('keeps text and replaces each image by its sanitized WebP', async () => {
    const sanitize = vi.fn(okSanitizer)
    const result = await normalizeChatMessages(
      {
        messages: [
          user([
            { type: 'text', text: 'Voici la fiche' },
            { type: 'file', mediaType: 'image/png', filename: 'fiche.png', url: png() },
          ]),
        ],
      },
      sanitize
    )

    expect(result).toEqual({
      status: 'OK',
      messages: [
        {
          id: 'm0',
          role: 'user',
          parts: [
            { type: 'text', text: 'Voici la fiche' },
            {
              type: 'file',
              mediaType: 'image/webp',
              filename: 'fiche.png',
              url: 'data:image/webp;base64,c2FuaXRpemVk',
            },
          ],
        },
      ],
    })
    expect(sanitize).toHaveBeenCalledWith(new Uint8Array(Buffer.from('iVBORw0KGgo=', 'base64')))
  })

  it('refuses a declared type outside the allowlist', async () => {
    const result = await normalizeChatMessages(
      {
        messages: [
          user([{ type: 'file', mediaType: 'image/gif', url: 'data:image/gif;base64,AA==' }]),
        ],
      },
      okSanitizer
    )

    expect(result).toEqual({ status: 'forbiddenFile' })
  })

  it('never follows a remote URL', async () => {
    const sanitize = vi.fn()
    const result = await normalizeChatMessages(
      {
        messages: [
          user([{ type: 'file', mediaType: 'image/png', url: 'https://example.com/fiche.png' }]),
        ],
      },
      sanitize
    )

    expect(result).toEqual({ status: 'forbiddenFile' })
    expect(sanitize).not.toHaveBeenCalled()
  })

  it('refuses a data URL whose prefix disagrees with the allowlist', async () => {
    const result = await normalizeChatMessages(
      {
        messages: [
          user([
            { type: 'file', mediaType: 'image/png', url: 'data:image/svg+xml;base64,PHN2Zz4=' },
          ]),
        ],
      },
      okSanitizer
    )

    expect(result).toEqual({ status: 'forbiddenFile' })
  })

  it('passes a PDF through untouched once its signature is checked', async () => {
    const sanitize = vi.fn(okSanitizer)
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.7\n').toString('base64')}`
    const result = await normalizeChatMessages(
      {
        messages: [
          user([{ type: 'file', mediaType: 'application/pdf', filename: 'fiche.pdf', url: pdf }]),
        ],
      },
      sanitize
    )

    expect(result).toEqual({
      status: 'OK',
      messages: [
        {
          id: 'm0',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'application/pdf', filename: 'fiche.pdf', url: pdf }],
        },
      ],
    })
    expect(sanitize).not.toHaveBeenCalled()
  })

  it('refuses a PDF without its signature or whose prefix disagrees with its type', async () => {
    const fake = `data:application/pdf;base64,${Buffer.from('<html>').toString('base64')}`
    expect(
      await normalizeChatMessages(
        { messages: [user([{ type: 'file', mediaType: 'application/pdf', url: fake }])] },
        okSanitizer
      )
    ).toEqual({ status: 'unreadableImage' })

    const mismatched = `data:application/pdf;base64,${Buffer.from('%PDF-1.7').toString('base64')}`
    expect(
      await normalizeChatMessages(
        { messages: [user([{ type: 'file', mediaType: 'image/png', url: mismatched }])] },
        okSanitizer
      )
    ).toEqual({ status: 'forbiddenFile' })
  })

  it('surfaces the sanitizer verdict', async () => {
    const sanitize: ImageSanitizer = async () => ({ status: 'unreadableImage' })

    const result = await normalizeChatMessages(
      { messages: [user([{ type: 'file', mediaType: 'image/png', url: png() }])] },
      sanitize
    )

    expect(result).toEqual({ status: 'unreadableImage' })
  })

  it('bounds images per message and per conversation before decoding', async () => {
    const sanitize = vi.fn(okSanitizer)
    const image = { type: 'file', mediaType: 'image/png', url: png() }
    const perMessage = Array.from(
      { length: AI_ASSISTANT_LIMITS.maxImagesPerMessage + 1 },
      () => image
    )

    expect(await normalizeChatMessages({ messages: [user(perMessage)] }, sanitize)).toEqual({
      status: 'tooManyImages',
    })
    sanitize.mockClear()

    const turns = Array.from({ length: AI_ASSISTANT_LIMITS.maxImagesPerRequest + 1 }, () =>
      user([image])
    )
    expect(await normalizeChatMessages({ messages: turns }, sanitize)).toEqual({
      status: 'tooManyImages',
    })
    expect(sanitize.mock.calls.length).toBeLessThanOrEqual(AI_ASSISTANT_LIMITS.maxImagesPerRequest)
  })

  it('refuses an oversized payload without decoding it', async () => {
    const sanitize = vi.fn(okSanitizer)
    const huge = 'A'.repeat(Math.ceil((AI_ASSISTANT_LIMITS.maxImageBytes / 3) * 4) + 4)

    expect(
      await normalizeChatMessages(
        { messages: [user([{ type: 'file', mediaType: 'image/png', url: png(huge) }])] },
        sanitize
      )
    ).toEqual({ status: 'imageTooLarge' })
    expect(sanitize).not.toHaveBeenCalled()
  })

  it('bounds the text of one message and the number of turns', async () => {
    const long = 'x'.repeat(AI_ASSISTANT_LIMITS.maxTextChars + 1)
    expect(
      await normalizeChatMessages({ messages: [user([{ type: 'text', text: long }])] }, okSanitizer)
    ).toEqual({ status: 'messageTooLong' })

    const many = Array.from({ length: AI_ASSISTANT_LIMITS.maxMessages + 1 }, () =>
      user([{ type: 'text', text: 'a' }])
    )
    expect(await normalizeChatMessages({ messages: many }, okSanitizer)).toEqual({
      status: 'tooManyMessages',
    })
  })

  it('drops tool parts of tools the route does not expose', async () => {
    const result = await normalizeChatMessages(
      {
        messages: [
          user([{ type: 'text', text: 'fiche' }]),
          assistant([
            { type: 'step-start' },
            {
              type: 'tool-propose_enrollment',
              toolCallId: 'call-1',
              state: 'output-available',
              input: { familyName: 'Durand' },
              output: { status: 'proposed' },
            },
            { type: 'text', text: 'Voici ma proposition.' },
          ]),
          user([{ type: 'text', text: 'merci' }]),
        ],
      },
      okSanitizer
    )

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.messages[1].parts).toEqual([
      { type: 'step-start' },
      { type: 'text', text: 'Voici ma proposition.' },
    ])
  })

  it('refuses a file part sent as the assistant', async () => {
    const result = await normalizeChatMessages(
      {
        messages: [
          assistant([{ type: 'file', mediaType: 'image/png', url: png() }]),
          user([{ type: 'text', text: 'a' }]),
        ],
      },
      okSanitizer
    )

    expect(result).toEqual({ status: 'invalidRequest' })
  })

  describe('tool replay', () => {
    const toolNames = new Set(['list_levels', 'commit_enroll_family'])
    const listed = {
      type: 'tool-list_levels',
      toolCallId: 'call-1',
      state: 'output-available',
      input: {},
      output: [{ id: 'level-1', name: 'CE1' }],
    }
    const answered = {
      type: 'tool-commit_enroll_family',
      toolCallId: 'call-2',
      state: 'approval-responded',
      input: { draftId: 'draft-1' },
      approval: { id: 'approval-1', approved: true, signature: 'sig', extra: 'dropped' },
    }

    it('replays a known tool result and keeps the history ending with the user', async () => {
      const result = await normalizeChatMessages(
        {
          messages: [
            user([{ type: 'text', text: 'a' }]),
            assistant([listed]),
            user([{ type: 'text', text: 'b' }]),
          ],
        },
        okSanitizer,
        { toolNames }
      )

      expect(result.status).toBe('OK')
      if (result.status !== 'OK') return
      expect(result.messages[1].parts).toEqual([listed])
    })

    it('accepts an answered approval as the last message, keeping only known fields', async () => {
      const result = await normalizeChatMessages(
        { messages: [user([{ type: 'text', text: 'a' }]), assistant([answered])] },
        okSanitizer,
        { toolNames }
      )

      expect(result.status).toBe('OK')
      if (result.status !== 'OK') return
      expect(result.messages[1].parts[0]).toEqual({
        ...answered,
        approval: { id: 'approval-1', approved: true, signature: 'sig' },
      })
    })

    it('still refuses a plain assistant message in last position', async () => {
      const result = await normalizeChatMessages(
        { messages: [user([{ type: 'text', text: 'a' }]), assistant([listed])] },
        okSanitizer,
        { toolNames }
      )

      expect(result).toEqual({ status: 'invalidRequest' })
    })

    it('refuses a tool the route does not expose', async () => {
      const result = await normalizeChatMessages(
        {
          messages: [
            user([{ type: 'text', text: 'a' }]),
            assistant([{ ...listed, type: 'tool-drop_database' }]),
            user([{ type: 'text', text: 'b' }]),
          ],
        },
        okSanitizer,
        { toolNames }
      )

      expect(result).toEqual({ status: 'invalidRequest' })
    })

    it('refuses an approval without a decision', async () => {
      const result = await normalizeChatMessages(
        {
          messages: [
            user([{ type: 'text', text: 'a' }]),
            assistant([{ ...answered, approval: { id: 'approval-1' } }]),
          ],
        },
        okSanitizer,
        { toolNames }
      )

      expect(result).toEqual({ status: 'invalidRequest' })
    })

    it('caps the replayed tool results', async () => {
      const huge = { ...listed, output: 'x'.repeat(AI_ASSISTANT_LIMITS.maxToolReplayChars + 1) }
      const result = await normalizeChatMessages(
        {
          messages: [
            user([{ type: 'text', text: 'a' }]),
            assistant([huge]),
            user([{ type: 'text', text: 'b' }]),
          ],
        },
        okSanitizer,
        { toolNames }
      )

      expect(result).toEqual({ status: 'messageTooLong' })
    })

    it('refuses tool parts on a route without tools', async () => {
      const result = await normalizeChatMessages(
        {
          messages: [
            user([{ type: 'text', text: 'a' }]),
            assistant([listed]),
            user([{ type: 'text', text: 'b' }]),
          ],
        },
        okSanitizer
      )

      expect(result).toEqual({ status: 'invalidRequest' })
    })
  })
})
