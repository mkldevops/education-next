import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/auth-client', () => ({
  resetPassword: vi.fn(),
}))

import { resetPassword } from '@/lib/auth-client'
import { ResetPasswordForm } from '../reset-password-form'

const fill = (password: string, confirmation: string) => {
  fireEvent.change(screen.getByLabelText('password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'submit' }))
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset()
  })

  it('offers a new link when the token is missing', () => {
    render(<ResetPasswordForm token={undefined} />)

    expect(screen.getByRole('heading', { name: 'invalidTitle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'requestNewLink' })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  it('refuses mismatching passwords without calling the server', async () => {
    render(<ResetPasswordForm token="reset-token" />)

    fill('secret123', 'secret124')

    expect(await screen.findByRole('alert')).toHaveTextContent('passwordMismatch')
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('shows the success state with a sign-in link', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ data: null, error: null } as never)
    render(<ResetPasswordForm token="reset-token" />)

    fill('secret123', 'secret123')

    expect(await screen.findByRole('heading', { name: 'successTitle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'signIn' })).toHaveAttribute('href', '/login')
    expect(resetPassword).toHaveBeenCalledWith({ token: 'reset-token', newPassword: 'secret123' })
  })

  it('wires the password hint to the field', () => {
    render(<ResetPasswordForm token="reset-token" />)

    expect(screen.getByLabelText('password')).toHaveAccessibleDescription('passwordHint')
    expect(screen.getByLabelText('password')).toHaveAttribute('autocomplete', 'new-password')
  })
})
