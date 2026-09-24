import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.rich = (key: string) => key
    return t
  },
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))

vi.mock('@/lib/auth-client', () => ({
  requestPasswordReset: vi.fn(),
}))

import { requestPasswordReset } from '@/lib/auth-client'
import { ForgotPasswordForm } from '../forgot-password-form'

const submit = () => {
  render(<ForgotPasswordForm />)
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'parent@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'submit' }))
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset()
  })

  it('shows the check-your-inbox state once the link is sent', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ data: null, error: null } as never)

    submit()

    expect(await screen.findByRole('heading', { name: 'successTitle' })).toBeInTheDocument()
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'parent@example.com',
      redirectTo: '/reset-password',
    })
  })

  it('confirms a resend without leaving the success state', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ data: null, error: null } as never)

    submit()
    fireEvent.click(await screen.findByRole('button', { name: 'resend' }))

    expect(await screen.findByRole('status')).toHaveTextContent('resent')
    expect(requestPasswordReset).toHaveBeenCalledTimes(2)
  })

  it('lets the user go back and fix the address', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ data: null, error: null } as never)

    submit()
    fireEvent.click(await screen.findByRole('button', { name: 'changeEmail' }))

    expect(screen.getByLabelText('email')).toHaveValue('parent@example.com')
  })

  it('keeps the form and reports the error when sending fails', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as never)

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('error')
    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()
  })
})
