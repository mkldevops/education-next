import { describe, expect, it } from 'vitest'
import { commitAfterPreview, prepareAssistantStep } from './commit-after-preview'

const tools = new Set(['preview_record_payment', 'commit_record_payment', 'list_plans'])
const clean = { draftId: 'd1', checksum: 'c1', plan: {}, warnings: [], blockers: [] }

describe('commitAfterPreview', () => {
  it('forces the matching commit after a clean preview', () => {
    const steps = [{ toolResults: [{ toolName: 'preview_record_payment', output: clean }] }]
    expect(commitAfterPreview(steps, tools)).toEqual({
      toolChoice: { type: 'tool', toolName: 'commit_record_payment' },
    })
  })

  it('lets the model speak when the preview is blocked', () => {
    const blocked = { draftId: null, checksum: null, blockers: [{ reason: 'nothingDue' }] }
    const steps = [{ toolResults: [{ toolName: 'preview_record_payment', output: blocked }] }]
    expect(commitAfterPreview(steps, tools)).toBeUndefined()
  })

  it('ignores a typed refusal, other tools and an unavailable commit', () => {
    expect(
      commitAfterPreview(
        [{ toolResults: [{ toolName: 'preview_record_payment', output: { error: 'x' } }] }],
        tools
      )
    ).toBeUndefined()
    expect(
      commitAfterPreview([{ toolResults: [{ toolName: 'list_plans', output: clean }] }], tools)
    ).toBeUndefined()
    expect(
      commitAfterPreview(
        [{ toolResults: [{ toolName: 'preview_enroll_family', output: clean }] }],
        tools
      )
    ).toBeUndefined()
  })

  it('only looks at the last step', () => {
    const steps = [
      { toolResults: [{ toolName: 'preview_record_payment', output: clean }] },
      { toolResults: [] },
    ]
    expect(commitAfterPreview(steps, tools)).toBeUndefined()
    expect(commitAfterPreview([], tools)).toBeUndefined()
  })
})

describe('prepareAssistantStep', () => {
  const idle = { toolCalls: [], toolResults: [] }
  const names = new Set([...tools, 'load_tools'])

  it('reserves the last allowed step for a text answer', () => {
    expect(prepareAssistantStep([idle, idle], names, 3)).toEqual({
      toolChoice: 'none',
      activeTools: [],
    })
  })

  it('exposes only the core tools until a group is loaded', () => {
    expect(prepareAssistantStep([idle], names, 3)).toEqual({
      activeTools: ['list_plans', 'load_tools'],
    })
  })

  it('still forces the commit of a clean preview on the last step, with its group active', () => {
    const steps = [
      idle,
      {
        toolCalls: [{ toolName: 'preview_record_payment', input: {} }],
        toolResults: [{ toolName: 'preview_record_payment', output: clean }],
      },
    ]
    expect(prepareAssistantStep(steps, names, 3)).toEqual({
      toolChoice: { type: 'tool', toolName: 'commit_record_payment' },
      activeTools: ['list_plans', 'load_tools', 'preview_record_payment', 'commit_record_payment'],
    })
  })

  it('keeps the groups loaded in earlier turns', () => {
    const history = [
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'c1',
            toolName: 'load_tools',
            input: { groups: ['payments'] },
          },
        ],
      },
    ]
    expect(prepareAssistantStep([], names, 3, history)?.activeTools).toContain(
      'commit_record_payment'
    )
  })
})
