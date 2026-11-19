import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import {
  CONTINUE_MESSAGE,
  completeSentencesLength,
  continuationMessages,
  endedMidText,
  stitchContinuation,
  withoutUnfinishedSentence,
} from './continue-truncated'

const step = (finishReason: string, toolCalls: unknown[] = []) => ({ finishReason, toolCalls })

describe('endedMidText', () => {
  it('continues a turn whose last step ran out of tokens while writing', () => {
    expect(endedMidText([step('tool-calls', [{}]), step('length')])).toBe(true)
  })

  it('does not continue a finished turn, a truncated tool call or an empty turn', () => {
    expect(endedMidText([step('length'), step('stop')])).toBe(false)
    expect(endedMidText([step('length', [{}])])).toBe(false)
    expect(endedMidText([])).toBe(false)
  })
})

describe('continuationMessages', () => {
  it('appends the cut reply then the instruction to resume it', () => {
    const history: ModelMessage[] = [{ role: 'user', content: 'Présences de Chiyoni ?' }]
    const response: ModelMessage[] = [{ role: 'assistant', content: '5 appels validés et' }]
    expect(continuationMessages(history, response)).toEqual([
      ...history,
      ...response,
      CONTINUE_MESSAGE,
    ])
  })
})

describe('completeSentencesLength', () => {
  it('stops after the last complete sentence, line or list intro', () => {
    expect(completeSentencesLength('5 appels validés. 2 en')).toBe(18)
    expect(completeSentencesLength('Classes :\n- Chiyoni')).toBe(10)
    expect(completeSentencesLength('« Bonjour. » Puis')).toBe(13)
    expect(completeSentencesLength('5 appels validés et')).toBe(0)
  })
})

describe('stitchContinuation', () => {
  it('puts back the space the model leaves out between two sentences', () => {
    expect(stitchContinuation('5 appels validés.', '2 en attente.')).toBe(' 2 en attente.')
    expect(stitchContinuation('5 appels validés. ', ' 2 en attente.')).toBe('2 en attente.')
  })

  it('drops the end of the shown text when the model repeats it', () => {
    const previous = 'Une présence régulière compte. Enfin, elle prépare les élèves. '
    expect(stitchContinuation(previous, 'Enfin, elle prépare les élèves. À la vie.')).toBe(
      'À la vie.'
    )
    expect(
      stitchContinuation(previous, 'ière compte. Enfin, elle prépare les élèves. Aussi.')
    ).toBe('Aussi.')
  })

  it('keeps a short coincidence and the first text of a message', () => {
    expect(stitchContinuation('Il reste deux. ', 'deux. Puis trois.')).toBe('deux. Puis trois.')
    expect(stitchContinuation('', 'Bonjour')).toBe('Bonjour')
  })
})

describe('withoutUnfinishedSentence', () => {
  it('removes the unseen sentence from the cut reply', () => {
    const response: ModelMessage[] = [
      { role: 'assistant', content: [{ type: 'text', text: '5 appels validés. Puis 2 en' }] },
    ]
    expect(withoutUnfinishedSentence(response, 'Puis 2 en')).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: '5 appels validés.' }] },
    ])
    expect(withoutUnfinishedSentence(response, '')).toEqual(response)
  })
})
