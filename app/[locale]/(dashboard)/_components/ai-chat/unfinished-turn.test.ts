import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { endedTruncated, endedWithoutAnswer, joinAdjacentText } from './unfinished-turn'

function assistant(parts: UIMessage['parts']): UIMessage[] {
  return [
    { id: 'u', role: 'user', parts: [{ type: 'text', text: 'Akil a payé 10000' }] },
    { id: 'a', role: 'assistant', parts },
  ]
}

const toolCall = {
  type: 'tool-find_students',
  toolCallId: 't1',
  state: 'output-available',
  input: { query: 'Akil' },
  output: [],
} as const

describe('endedWithoutAnswer', () => {
  it('flags a turn that stops on a tool call or a reasoning', () => {
    expect(endedWithoutAnswer(assistant([{ type: 'step-start' }, toolCall]))).toBe(true)
    expect(
      endedWithoutAnswer(assistant([toolCall, { type: 'reasoning', text: 'hmm', state: 'done' }]))
    ).toBe(true)
  })

  it('accepts a turn that ends with text', () => {
    expect(
      endedWithoutAnswer(
        assistant([toolCall, { type: 'step-start' }, { type: 'text', text: 'OK' }])
      )
    ).toBe(false)
  })

  it('accepts a turn waiting for an approval', () => {
    const pending = {
      type: 'tool-commit_record_payment',
      toolCallId: 't2',
      state: 'approval-requested',
      input: { draftId: 'd' },
      approval: { id: 'ap' },
    } as const
    expect(endedWithoutAnswer(assistant([toolCall, pending]))).toBe(false)
  })

  it('ignores a conversation whose last message is the user one', () => {
    expect(endedWithoutAnswer(assistant([toolCall]).slice(0, 1))).toBe(false)
  })
})

describe('endedTruncated', () => {
  it('flags an assistant message marked truncated by the server', () => {
    const messages = assistant([{ type: 'text', text: 'Depuis le 1er novembre, et' }])
    expect(endedTruncated(messages)).toBe(false)
    const last = messages.at(-1)
    if (last) last.metadata = { truncated: true }
    expect(endedTruncated(messages)).toBe(true)
  })
})

describe('joinAdjacentText', () => {
  it('glues a continuation to the cut text without touching other parts', () => {
    expect(
      joinAdjacentText([
        toolCall,
        { type: 'text', text: '5 appels validés et' },
        { type: 'step-start' },
        { type: 'text', text: ' 2 en attente.' },
        { type: 'text', text: ' Fin.' },
      ])
    ).toEqual([
      toolCall,
      { type: 'text', text: '5 appels validés et' },
      { type: 'step-start' },
      { type: 'text', text: ' 2 en attente. Fin.' },
    ])
  })
})
