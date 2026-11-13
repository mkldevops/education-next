import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { endedWithoutAnswer } from './unfinished-turn'

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
