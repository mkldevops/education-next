import { createUIMessageStream, readUIMessageStream, streamText, type UIMessage } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { writeTurnWithContinuations } from './continue-truncated'

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

function reply(text: string | string[], finish: 'stop' | 'length') {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 't' },
      ...[text].flat().map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
      { type: 'text-end' as const, id: 't' },
      { type: 'finish' as const, finishReason: { unified: finish, raw: finish }, usage },
    ]),
  }
}

async function runWith(replies: Array<ReturnType<typeof reply>>, maxContinuations = 2) {
  const doStream = vi.fn()
  for (const next of replies) doStream.mockResolvedValueOnce(next)
  const model = new MockLanguageModelV4({ doStream })
  const onTruncated = vi.fn()
  const stream = createUIMessageStream({
    execute: ({ writer }) =>
      writeTurnWithContinuations({
        writer,
        history: [{ role: 'user', content: 'Présences de Chiyoni ?' }],
        runTurn: (messages) => streamText({ model, messages }),
        maxContinuations,
        onError: () => 'error',
        onTruncated,
      }),
  })
  let message: UIMessage | undefined
  for await (const snapshot of readUIMessageStream({ stream })) message = snapshot
  return { message, doStream, onTruncated }
}

const texts = (message: UIMessage | undefined) =>
  message?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('')

describe('writeTurnWithContinuations', () => {
  it('replaces the unfinished sentence with the continuation inside the same message', async () => {
    const { message, doStream, onTruncated } = await runWith([
      reply(['5 appels validés. ', 'Puis 2 en'], 'length'),
      reply('2 en attente sont à valider.', 'stop'),
    ])

    expect(texts(message)).toBe('5 appels validés. 2 en attente sont à valider.')
    expect(message?.parts.filter((part) => part.type === 'step-start')).toHaveLength(1)
    expect(message?.metadata).toBeUndefined()
    expect(onTruncated).not.toHaveBeenCalled()
    const resumed = doStream.mock.calls[1]?.[0].prompt
    expect(resumed.at(-2)).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: '5 appels validés.' }],
    })
    expect(resumed.at(-1)).toMatchObject({ role: 'user' })
  })

  it('drops a sentence the continuation repeats', async () => {
    const { message } = await runWith([
      reply('Les présences sont à jour pour la classe. Il reste deux ap', 'length'),
      reply(['Les présences sont à jour ', 'pour la classe. Il reste deux appels.'], 'stop'),
    ])

    expect(texts(message)).toBe('Les présences sont à jour pour la classe. Il reste deux appels.')
  })

  it('ends on the last complete sentence once the continuations run out', async () => {
    const { message, doStream, onTruncated } = await runWith(
      [reply('Un. Deux', 'length'), reply('Trois. Quat', 'length')],
      1
    )

    expect(doStream).toHaveBeenCalledTimes(2)
    expect(texts(message)).toBe('Un. Trois. ')
    expect(message?.metadata).toEqual({ truncated: true })
    expect(onTruncated).toHaveBeenCalledWith(1)
  })

  it('shows the last words of a reply that finished normally', async () => {
    const { message } = await runWith([reply(['Voici ', 'la liste'], 'stop')])
    expect(texts(message)).toBe('Voici la liste')
  })

  it('does not resume a reply that finished normally', async () => {
    const { doStream } = await runWith([reply('Fini.', 'stop')])
    expect(doStream).toHaveBeenCalledTimes(1)
  })
})
