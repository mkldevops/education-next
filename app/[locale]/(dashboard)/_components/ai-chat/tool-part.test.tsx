import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ToolUIPart } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({ Link: 'a' }))
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
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

function updatePlan({ discount }: { discount: number }) {
  const pricing = { plan: { id: 'p1', name: 'Mensuel' }, startMonth: null, planAmountDue: 300 }
  return {
    tool: 'update_enrollment',
    enrollment: { id: 'e1', student: 'Lina Benali', classPeriod: 'CP' },
    before: { ...pricing, discount: 0, totalAmount: 300, firstInstallmentAmount: null },
    after: {
      ...pricing,
      startMonth: '2026-10',
      discount,
      totalAmount: 150,
      firstInstallmentAmount: 50,
    },
    currency: 'EUR',
    schedule: {
      before: [
        { dueDate: '2026-09-01', amount: 100 },
        { dueDate: '2026-10-01', amount: 100 },
        { dueDate: '2026-11-01', amount: 100 },
      ],
      after: [
        { dueDate: '2026-10-01', amount: 50 },
        { dueDate: '2026-11-01', amount: 100 },
      ],
    },
    paid: 0,
    remaining: 150,
  }
}

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

  it('shows the schedule of an enrollment update before and after, not the raw plan', () => {
    render(
      <ToolPart
        part={{ ...pending, type: 'tool-commit_update_enrollment' } as ToolUIPart}
        plan={updatePlan({ discount: 0 })}
        onApproval={vi.fn()}
      />
    )

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // En-tête, trois échéances, total.
    expect(rows).toHaveLength(5)
    expect(rows[1]).toHaveTextContent(/septembre 2026.*100,00.*→.*none/)
    expect(rows[2]).toHaveTextContent(/octobre 2026.*100,00.*→.*50,00/)
    expect(rows[3]).toHaveTextContent(/novembre 2026.*100,00/)
    expect(rows[4]).toHaveTextContent(/total.*300,00.*→.*150,00/)
    expect(screen.getByText('Lina Benali')).toBeInTheDocument()
    expect(screen.queryByText(/discountWithFirstInstallment/)).not.toBeInTheDocument()
    // Le plan brut reste lisible, replié avec l'entrée exacte du commit.
    expect(screen.getByText(/"tool": "update_enrollment"/).closest('details')).not.toHaveAttribute(
      'open'
    )
  })

  it('warns when a discount coexists with a first month amount', () => {
    render(
      <ToolPart
        part={{ ...pending, type: 'tool-commit_update_enrollment' } as ToolUIPart}
        plan={updatePlan({ discount: 20 })}
        onApproval={vi.fn()}
      />
    )

    expect(screen.getByText(/discountWithFirstInstallment:\{"discount":"20,00/)).toBeInTheDocument()
  })

  it('lists the schedule of each student of a family enrollment', () => {
    render(
      <ToolPart
        part={pending}
        plan={{
          tool: 'enroll_family',
          family: { name: 'Benali' },
          currency: 'EUR',
          discount: 10,
          payment: null,
          students: [
            {
              name: 'Lina',
              lastname: 'Benali',
              classPeriod: { id: 'c1', name: 'CP' },
              plan: { id: 'p1', name: 'Mensuel', amount: 300 },
              firstInstallmentAmount: 50,
              totalAmount: 140,
              installments: [
                { dueDate: '2026-10-01', amount: 50 },
                { dueDate: '2026-11-01', amount: 90 },
              ],
            },
            {
              name: 'Adam',
              lastname: 'Benali',
              classPeriod: { id: 'c2', name: 'CE1' },
              plan: { id: 'p2', name: 'Annuel', amount: 250 },
              firstInstallmentAmount: null,
              totalAmount: 250,
              installments: [],
            },
          ],
        }}
        onApproval={vi.fn()}
      />
    )

    expect(screen.getByText('Lina Benali · CP · Mensuel')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows[1]).toHaveTextContent(/octobre 2026.*50,00/)
    expect(rows[2]).toHaveTextContent(/novembre 2026.*90,00/)
    expect(rows[3]).toHaveTextContent(/total.*140,00/)
    expect(screen.getByText('Adam Benali · CE1 · Annuel')).toBeInTheDocument()
    expect(screen.getByText(/total : 250,00/)).toBeInTheDocument()
    expect(screen.getByText(/discountWithFirstInstallment:\{"discount":"10,00/)).toBeInTheDocument()
  })

  it('falls back to the raw plan for a draft previewed without its schedule', () => {
    render(
      <ToolPart
        part={pending}
        plan={{ tool: 'enroll_family', family: { name: 'Benali' }, students: [{ name: 'Lina' }] }}
        onApproval={vi.fn()}
      />
    )

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/"tool": "enroll_family"/).closest('details')).toBeNull()
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
