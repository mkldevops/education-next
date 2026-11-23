import { describe, expect, it } from 'vitest'
import {
  AI_ASSISTANT_SUMMARY_LIMITS,
  assistantContextLoad,
  assistantSummaryTranscript,
} from '../ai-assistant'

const text = (role: 'user' | 'assistant', value: string) => ({
  role,
  parts: [{ type: 'text', text: value }],
})

describe('assistantContextLoad', () => {
  it('is light for a short conversation', () => {
    expect(assistantContextLoad([text('user', 'Bonjour')])).toEqual({
      heavy: false,
      toolBudget: false,
    })
  })

  it('is heavy from 30 messages on', () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      text(index % 2 ? 'assistant' : 'user', 'x')
    )
    expect(assistantContextLoad(messages.slice(0, 29)).heavy).toBe(false)
    expect(assistantContextLoad(messages).heavy).toBe(true)
  })

  it('blames the tool budget when replayed tool results grow large', () => {
    const big = {
      role: 'assistant',
      parts: [
        { type: 'tool-list_families', state: 'output-available', output: 'y'.repeat(46_000) },
      ],
    }
    expect(assistantContextLoad([text('user', 'liste'), big])).toEqual({
      heavy: true,
      toolBudget: true,
    })
  })

  it('is heavy from 6 attachments on', () => {
    const photos = {
      role: 'user',
      parts: Array.from({ length: 6 }, () => ({ type: 'file' })),
    }
    expect(assistantContextLoad([photos])).toEqual({ heavy: true, toolBudget: false })
  })
})

describe('assistantSummaryTranscript', () => {
  it('keeps text, attachment names and the outcome of every tool call', () => {
    const transcript = assistantSummaryTranscript([
      {
        role: 'user',
        parts: [
          { type: 'text', text: 'Inscris Yusri' },
          { type: 'file', filename: 'fiche.jpg' },
        ],
      },
      {
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-find_students',
            state: 'output-available',
            input: { q: 'Yusri' },
            output: [],
          },
          {
            type: 'tool-commit_enroll_family',
            state: 'output-available',
            approval: { approved: false },
            input: { draftId: 'd1' },
          },
          { type: 'tool-record_receipt', state: 'approval-requested', input: { amount: 30 } },
          { type: 'tool-move_student_to_class', state: 'output-error', errorText: 'classFull' },
          { type: 'tool-cancel_receipt', state: 'output-denied' },
          { type: 'text', text: 'Validez la carte.' },
        ],
      },
    ])

    expect(transcript).toContain('ADMIN: Inscris Yusri')
    expect(transcript).toContain('ADMIN: [attachment fiche.jpg, not available anymore]')
    expect(transcript).toContain('TOOL find_students [executed] input={"q":"Yusri"} result=[]')
    expect(transcript).toContain('TOOL commit_enroll_family [refused]')
    expect(transcript).toContain('TOOL record_receipt [awaiting-validation-not-done]')
    expect(transcript).toContain('TOOL move_student_to_class [failed] input= result=classFull')
    expect(transcript).toContain('TOOL cancel_receipt [refused]')
    expect(transcript).toContain('ASSISTANT: Validez la carte.')
  })

  it('truncates long tool excerpts', () => {
    const transcript = assistantSummaryTranscript([
      {
        role: 'assistant',
        parts: [
          { type: 'tool-list_families', state: 'output-available', output: 'z'.repeat(5_000) },
        ],
      },
    ])
    expect(transcript.length).toBeLessThan(AI_ASSISTANT_SUMMARY_LIMITS.maxToolExcerptChars + 100)
  })

  it('drops the oldest messages first beyond the transcript budget', () => {
    const block = 'w'.repeat(30_000)
    const transcript = assistantSummaryTranscript([
      text('user', `first ${block}`),
      text('assistant', `second ${block}`),
      text('user', `third ${block}`),
    ])
    expect(transcript).not.toContain('first')
    expect(transcript).toContain('second')
    expect(transcript).toContain('third')
    expect(transcript.length).toBeLessThanOrEqual(AI_ASSISTANT_SUMMARY_LIMITS.maxTranscriptChars)
  })

  it('ignores tool parts claimed by the admin', () => {
    expect(
      assistantSummaryTranscript([
        { role: 'user', parts: [{ type: 'tool-cancel_receipt', state: 'output-available' }] },
      ])
    ).toBe('')
  })
})
