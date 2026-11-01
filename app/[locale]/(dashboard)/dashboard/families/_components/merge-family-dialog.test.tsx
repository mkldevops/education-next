import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MergeFamilyDialog } from './merge-family-dialog'

const { mergeFamiliesAction, push, toastActionError } = vi.hoisted(() => ({
  mergeFamiliesAction: vi.fn(),
  push: vi.fn(),
  toastActionError: vi.fn(),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('../../../_lib/family-actions', () => ({ mergeFamiliesAction }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn() }, toastActionError }))

beforeEach(() => {
  vi.clearAllMocks()
  mergeFamiliesAction.mockResolvedValue('OK')
})

const open = () =>
  render(
    <MergeFamilyDialog
      familyId="source"
      familyName="Source"
      families={[
        { id: 'target', name: 'Target' },
        { id: 'other', name: 'Other' },
      ]}
      cleanUrl="/dashboard/families/source"
    />
  )

it('requires destination and explicit access confirmation, then navigates to the retained family', async () => {
  open()
  const submit = await screen.findByRole('button', { name: 'confirm' })
  expect(submit).toBeDisabled()
  fireEvent.change(screen.getByLabelText('target'), { target: { value: 'target' } })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByLabelText('confirmation'))
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
  await waitFor(() => expect(mergeFamiliesAction).toHaveBeenCalledWith('source', 'target'))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/families/target'))
})

it('clears confirmation when changing destination and keeps errors in the dialog', async () => {
  mergeFamiliesAction.mockResolvedValue('pendingPayment')
  open()
  const select = await screen.findByLabelText('target')
  fireEvent.change(select, { target: { value: 'target' } })
  fireEvent.click(screen.getByLabelText('confirmation'))
  fireEvent.change(select, { target: { value: 'other' } })
  expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText('confirmation'))
  fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
  await waitFor(() =>
    expect(toastActionError).toHaveBeenCalledWith(expect.any(Function), 'pendingPayment')
  )
  expect(push).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
