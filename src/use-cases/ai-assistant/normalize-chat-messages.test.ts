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

  it('replays completed proposals of the assistant and drops incomplete ones', async () => {
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
            { type: 'tool-propose_enrollment', toolCallId: 'call-2', state: 'input-streaming' },
            { type: 'tool-something_else', toolCallId: 'call-3', state: 'output-available' },
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
      {
        type: 'tool-propose_enrollment',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { familyName: 'Durand' },
        output: { status: 'proposed' },
      },
      { type: 'text', text: 'Voici ma proposition.' },
    ])
  })

  it('bounds a replayed proposal like text and requires objects', async () => {
    const proposal = (input: unknown, output: unknown = { status: 'proposed' }) => ({
      type: 'tool-propose_enrollment',
      toolCallId: 'call-1',
      state: 'output-available',
      input,
      output,
    })
    const oversized = { notes: 'x'.repeat(AI_ASSISTANT_LIMITS.maxTextChars) }

    expect(
      (
        await normalizeChatMessages(
          { messages: [assistant([proposal(oversized)]), user([{ type: 'text', text: 'ok' }])] },
          okSanitizer
        )
      ).status
    ).toBe('messageTooLong')
    expect(
      (
        await normalizeChatMessages(
          { messages: [assistant([proposal('Durand')]), user([{ type: 'text', text: 'ok' }])] },
          okSanitizer
        )
      ).status
    ).toBe('invalidRequest')
    expect(
      (
        await normalizeChatMessages(
          {
            messages: [
              assistant([proposal({ familyName: 'Durand' }, 'proposed')]),
              user([{ type: 'text', text: 'ok' }]),
            ],
          },
          okSanitizer
        )
      ).status
    ).toBe('invalidRequest')
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
})
