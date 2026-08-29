import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acceptInvitationAction: vi.fn(),
  signInEmail: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionError: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = () => true
    return t
  },
}))

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: mocks.signInEmail },
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
  toastActionError: mocks.toastActionError,
}))

vi.mock('../_lib/accept-invitation-action', () => ({
  acceptInvitationAction: mocks.acceptInvitationAction,
}))

import { AcceptInvitationForm } from './accept-invitation-form'

const submitForm = () => {
  render(<AcceptInvitationForm token="invite-token" email="parent@example.com" />)

  fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Parent User' } })
  fireEvent.change(screen.getByLabelText('password'), { target: { value: 'secret123' } })
  const form = screen.getByRole('button', { name: 'submit' }).closest('form')
  expect(form).toBeInstanceOf(HTMLFormElement)
  if (!(form instanceof HTMLFormElement)) return
  fireEvent.submit(form)
}

describe('AcceptInvitationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.acceptInvitationAction.mockResolvedValue('OK')
    mocks.signInEmail.mockResolvedValue({ error: null })
  })

  it('signs in the invited user before redirecting to the dashboard', async () => {
    submitForm()

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/dashboard')
    })

    expect(mocks.acceptInvitationAction).toHaveBeenCalledWith({
      token: 'invite-token',
      name: 'Parent User',
      password: 'secret123',
    })
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'secret123',
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith('success')
  })

  it('keeps the user on the invitation page when automatic sign-in fails', async () => {
    mocks.signInEmail.mockResolvedValue({ error: { status: 500 } })

    submitForm()

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('errors.signInFailed')
    })

    expect(mocks.push).not.toHaveBeenCalled()
  })
})
