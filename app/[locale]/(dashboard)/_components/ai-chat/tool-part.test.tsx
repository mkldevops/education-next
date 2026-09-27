import { fireEvent, render, screen } from '@testing-library/react'
import type { ToolUIPart } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({ Link: 'a' }))
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
    t.has = (key: string) => key === 'names.commit_enroll_family'
    return t
  },
  useFormatter: () => ({
    number: (value: number) => `${value} EUR`,
    dateTime: (value: Date) => value.toISOString().slice(0, 10),
  }),
}))

const { ToolPart } = await import('./tool-part')

const pending = {
  type: 'tool-commit_enroll_family',
  toolCallId: 'call-1',
  state: 'approval-requested',
  input: { draftId: 'draft-1', checksum: 'abc' },
  approval: { id: 'approval-1' },
} as ToolUIPart

describe('ToolPart', () => {
  it('shows the exact input and sends the decision by approval id', () => {
    const onApproval = vi.fn()
    render(<ToolPart part={pending} onApproval={onApproval} />)

    expect(screen.getByText(/"draftId": "draft-1"/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'approval.approve' }))
    expect(onApproval).toHaveBeenCalledWith({ id: 'approval-1', approved: true })

    fireEvent.click(screen.getByRole('button', { name: 'approval.refuse' }))
    expect(onApproval).toHaveBeenLastCalledWith({ id: 'approval-1', approved: false })
  })

  it('summarises the previewed payment above the approval buttons', () => {
    render(
      <ToolPart
        part={pending}
        plan={{
          tool: 'record_payment',
          family: { id: 'f1', name: 'Benali' },
          amount: 600,
          method: 'CASH',
          paidAt: '2026-09-27T08:00:00.000Z',
        }}
        onApproval={vi.fn()}
      />
    )

    expect(screen.getByText('Benali')).toBeInTheDocument()
    expect(screen.getByText('600 EUR')).toBeInTheDocument()
    expect(screen.getByText('2026-09-27')).toBeInTheDocument()
  })

  it('surfaces a typed refusal returned by the tool', () => {
    render(
      <ToolPart
        part={
          {
            type: 'tool-list_levels',
            toolCallId: 'call-2',
            state: 'output-available',
            input: {},
            output: { error: 'draftExpired' },
          } as ToolUIPart
        }
        onApproval={vi.fn()}
      />
    )

    expect(
      screen.getByText('refusal:{"tool":"list_levels","code":"draftExpired"}')
    ).toBeInTheDocument()
  })

  it('marks a refused write without offering the buttons again', () => {
    render(
      <ToolPart
        part={
          {
            ...pending,
            state: 'output-denied',
            approval: { id: 'approval-1', approved: false },
          } as ToolUIPart
        }
        onApproval={vi.fn()}
      />
    )

    expect(screen.getByText('refused:{"tool":"names.commit_enroll_family"}')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
