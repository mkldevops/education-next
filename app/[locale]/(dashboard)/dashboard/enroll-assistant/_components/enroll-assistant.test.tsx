import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const chat = {
  messages: [] as UIMessage[],
  status: 'ready' as 'ready' | 'submitted' | 'streaming' | 'error',
  error: undefined as Error | undefined,
}
const sendMessage = vi.fn()
const stop = vi.fn()
const clearError = vi.fn()
const setMessages = vi.fn()
const previewAction = vi.fn()
const confirmAction = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()
const toastActionError = vi.fn()

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({ ...chat, sendMessage, stop, clearError, setMessages }),
}))
vi.mock('ai', () => ({ DefaultChatTransport: class {} }))
vi.mock('next-intl', () => {
  const translator = (namespace: string) => {
    const scope = namespace.split('.').pop()
    const t = (key: string, params?: Record<string, unknown>) =>
      params ? `${scope}.${key}:${JSON.stringify(params)}` : `${scope}.${key}`
    t.has = (key: string) => !key.endsWith('.unknownCode')
    return t
  }
  return { useTranslations: translator, useLocale: () => 'fr' }
})
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/toast', () => ({
  toast: { error: toastError, success: toastSuccess },
  toastActionError,
}))
vi.mock('../../../_lib/enroll-assistant-actions', () => ({
  previewAssistantEnrollmentAction: previewAction,
  confirmAssistantEnrollmentAction: confirmAction,
}))

const { EnrollAssistant } = await import('./enroll-assistant')

const familyInput = () => document.getElementById('familyName') as HTMLInputElement
const waitForFamily = () => waitFor(() => expect(familyInput()).toHaveValue('Durand'))

const draftId = '00000000-0000-4000-8000-000000000001'
const checksum = 'abcdef012345'

const proposalMessage = (toolCallId: string, input: unknown): UIMessage => ({
  id: `a-${toolCallId}`,
  role: 'assistant',
  parts: [
    {
      type: 'tool-propose_enrollment',
      toolCallId,
      state: 'output-available',
      input,
      output: { status: 'proposed' },
    } as UIMessage['parts'][number],
  ],
})

const durand = {
  familyName: 'Durand',
  parents: [{ name: 'Alice', lastname: 'Durand' }],
  students: [{ name: 'Léo', lastname: 'Durand', className: 'CE1' }],
  missing: [{ field: 'students.0.birthday', reason: 'illegible' }],
}

const readyPreview = {
  status: 'preview',
  draftId,
  checksum,
  plan: {
    family: { existing: false, name: 'Durand' },
    parentCount: 1,
    students: [
      { name: 'Léo', lastname: 'Durand', className: 'CE1', planName: 'Annuel', amount: 300 },
    ],
    payment: null,
  },
  matches: { families: [{ id: 'family-9', name: 'Durand' }], students: [] },
  warnings: [],
  blockers: [],
}

function renderAssistant(paymentsEnabled = true) {
  return render(
    <EnrollAssistant schoolName="École A" paymentsEnabled={paymentsEnabled} model="test/model" />
  )
}

async function requestPreview() {
  fireEvent.click(screen.getByRole('button', { name: 'proposal.requestPreview' }))
  await waitFor(() => expect(previewAction).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  chat.messages = []
  chat.status = 'ready'
  chat.error = undefined
  previewAction.mockResolvedValue(readyPreview)
  confirmAction.mockResolvedValue({
    status: 'committed',
    familyId: 'family-1',
    studentIds: ['s1', 's2'],
    enrollmentIds: ['e1', 'e2'],
    paymentIds: [],
  })
})

describe('EnrollAssistant', () => {
  it('shows the active school and the provider notice with the model', () => {
    renderAssistant()

    expect(screen.getByText('enrollAssistant.school:{"name":"École A"}')).toBeInTheDocument()
    expect(
      screen.getByText('enrollAssistant.providerNotice:{"model":"test/model"}')
    ).toBeInTheDocument()
  })

  it('fills the form from the latest complete proposal and lists what is missing', async () => {
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()

    await waitForFamily()
    expect(screen.getByDisplayValue('Léo')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CE1')).toBeInTheDocument()
    expect(screen.getByText('students.0.birthday')).toBeInTheDocument()
    expect(screen.getByText(/proposal\.missing\.illegible/)).toBeInTheDocument()
  })

  it('reports an unusable proposal without touching the form', async () => {
    chat.messages = [proposalMessage('call-1', { students: 'nope' })]
    renderAssistant()

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('enrollAssistant.chat.errors.invalidModelOutput')
    )
    expect(familyInput()).toHaveValue('')
  })

  it('previews the corrected form, not the proposal, and confirms by draft reference', async () => {
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()
    fireEvent.change(familyInput(), { target: { value: 'Durand-Petit' } })

    await requestPreview()

    expect(previewAction).toHaveBeenCalledWith(
      expect.objectContaining({ familyName: 'Durand-Petit' })
    )
    expect(screen.getByText('preview.ready:{"minutes":30}')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'preview.confirm' }))

    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith({ draftId, checksum }))
    expect(await screen.findAllByText('confirm.success')).not.toHaveLength(0)
    expect(
      screen.getByText('confirm.successDetail:{"students":2,"payments":0}')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'confirm.openFamily' })).toHaveAttribute(
      'href',
      '/dashboard/families/family-1'
    )
  })

  it('invalidates the preview as soon as a field changes, until a new preview', async () => {
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()
    await requestPreview()

    expect(screen.getByRole('button', { name: 'preview.confirm' })).toBeEnabled()

    fireEvent.change(screen.getByDisplayValue('CE1'), { target: { value: 'CE2' } })

    expect(screen.getByText('proposal.edited')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preview.confirm' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'proposal.requestPreview' }))
    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2))

    expect(screen.queryByText('proposal.edited')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preview.confirm' })).toBeEnabled()
  })

  it('marks the invalid fields named by the server', async () => {
    previewAction.mockResolvedValue({
      status: 'validationError',
      fields: ['students.0.birthday'],
    })
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()

    await requestPreview()

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'proposal.errors.validationError:{"fields":"students.0.birthday"}'
      )
    )
    expect(document.getElementById('students.0.birthday')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('button', { name: 'preview.confirm' })).not.toBeInTheDocument()
  })

  it('attaches to an existing family only through the match button, then drops the parents', async () => {
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()
    await requestPreview()

    fireEvent.click(screen.getByRole('button', { name: 'preview.useFamily' }))

    expect(screen.getByText('proposal.family.selected:{"name":"Durand"}')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Alice')).not.toBeInTheDocument()
    expect(screen.getByText('proposal.edited')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'proposal.requestPreview' }))
    await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2))

    const input = previewAction.mock.calls[1][0]
    expect(input.familyId).toBe('family-9')
    expect(input).not.toHaveProperty('parents')
  })

  it('explains a refused confirmation and asks for a new preview', async () => {
    confirmAction.mockResolvedValue({ status: 'refused', reason: 'draftExpired' })
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()
    await requestPreview()

    fireEvent.click(screen.getByRole('button', { name: 'preview.confirm' }))

    await waitFor(() =>
      expect(toastActionError).toHaveBeenCalledWith(expect.any(Function), 'draftExpired')
    )
    expect(screen.queryByRole('button', { name: 'preview.confirm' })).not.toBeInTheDocument()
  })

  it('shows a blocked preview without a confirm button', async () => {
    previewAction.mockResolvedValue({
      status: 'blocked',
      matches: { families: [], students: [] },
      warnings: [],
      blockers: [{ field: 'students.0.className', value: 'CE9', reason: 'unknownClass' }],
    })
    chat.messages = [proposalMessage('call-1', durand)]
    renderAssistant()
    await waitForFamily()

    await requestPreview()

    expect(screen.getByText('preview.blocked')).toBeInTheDocument()
    expect(
      screen.getByText(
        'preview.finding:{"field":"students.0.className","value":"CE9","reason":"reasons.unknownClass"}'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'preview.confirm' })).not.toBeInTheDocument()
  })

  it('translates a refusal code carried by the chat error', () => {
    chat.error = new Error(JSON.stringify({ error: 'aiAssistantDisabled' }))
    renderAssistant()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'enrollAssistant.chat.errors.aiAssistantDisabled'
    )
  })

  it('falls back to a generic message for an unknown code', () => {
    chat.error = new Error('unknownCode')
    renderAssistant()

    expect(screen.getByRole('alert')).toHaveTextContent('enrollAssistant.chat.errors.error')
  })

  it('hides pricing and payment when payments are disabled', () => {
    renderAssistant(false)

    expect(screen.getByText('proposal.pricing.disabled')).toBeInTheDocument()
    expect(screen.queryByText('proposal.payment.title')).not.toBeInTheDocument()
  })
})
