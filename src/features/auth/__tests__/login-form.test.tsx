import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/actions', () => ({
  getPasskeyAuthenticationOptions: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
}))

import { signIn } from '@/lib/auth-client'
import { LoginForm } from '../login-form'

const button = (name: string) => screen.queryByRole('button', { name })

describe('LoginForm sign-in methods', () => {
  it('offers both alternatives when the platform enables them', () => {
    render(<LoginForm googleEnabled passkeyEnabled />)

    expect(button('signInWithGoogle')).not.toBeNull()
    expect(button('signInWithPasskey')).not.toBeNull()
    expect(screen.queryByText('or')).not.toBeNull()
  })

  it('hides google when the platform disables it', () => {
    render(<LoginForm googleEnabled={false} passkeyEnabled />)

    expect(button('signInWithGoogle')).toBeNull()
    expect(button('signInWithPasskey')).not.toBeNull()
  })

  it('drops the separator when email and password is the only method left', () => {
    render(<LoginForm googleEnabled={false} passkeyEnabled={false} />)

    expect(button('signInWithGoogle')).toBeNull()
    expect(button('signInWithPasskey')).toBeNull()
    expect(screen.queryByText('or')).toBeNull()
    expect(button('submit')).not.toBeNull()
  })
})

describe('LoginForm handleGoogleSignIn', () => {
  beforeEach(() => {
    vi.mocked(signIn.social).mockReset()
  })

  it('calls signIn.social with the google provider and dashboard callback on click', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null } as never)

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    await waitFor(() =>
      expect(signIn.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/dashboard' })
    )
  })

  it('shows the google error message when signIn.social rejects', async () => {
    vi.mocked(signIn.social).mockRejectedValue(new Error('network error'))

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    expect(await screen.findByText('googleError')).not.toBeNull()
  })

  it('shows the google error message when signIn.social resolves with an error', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: { message: 'oauth' } } as never)

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    expect(await screen.findByText('googleError')).not.toBeNull()
  })
})
